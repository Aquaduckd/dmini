import type { LayoutDoc } from "../layout/types.js";

export interface Mana2MagicRule {
  inputs: string;
  output: string;
}

export interface Mana2LayoutFile {
  layout: {
    fingers: string[];
    thumbs: [string, string];
  };
  fingermap: string[];
  board: {
    isRowStaggered: boolean;
    mirrorLeftRowStagger: boolean;
    splitAngle: number;
    rowOrColumnStagger: number[];
  };
  magic?: {
    magicKeys: null;
    rules: Mana2MagicRule[];
  };
}

const FINGER_INDEX: Record<string, number> = {
  LP: 0,
  LR: 1,
  LM: 2,
  LI: 3,
  LT: 4,
  RT: 5,
  RI: 6,
  RM: 7,
  RR: 8,
  RP: 9,
};

function gridToken(character: string): string {
  if (!character) return "skip";
  if (character === " ") return "space";
  return character;
}

function physicalThumbSide(board: string, finger: string, col: number): "LT" | "RT" {
  const anchor = finger === "LT" ? 3 : 6;
  return anchor + col < 4.5 ? "LT" : "RT";
}

function rowStagger(board: string, numRows: number): number[] {
  if (board !== "rowstag") {
    return Array.from({ length: numRows }, () => 0);
  }

  const offsets = [0, 0.25, 0.75];
  return Array.from({ length: numRows }, (_, index) =>
    index < offsets.length ? offsets[index] : offsets[offsets.length - 1],
  );
}

function mana2Board(layoutBoard: string): "rowstag" | "ortho" {
  return layoutBoard === "ortho" ? "ortho" : "rowstag";
}

export function layoutHasMagicRules(layout: LayoutDoc): boolean {
  return (layout.magic?.length ?? 0) > 0;
}

export function layoutHasThumbKeys(layout: Pick<LayoutDoc, "keys">): boolean {
  return Object.values(layout.keys).some(
    (position) =>
      position.finger === "LT" ||
      position.finger === "RT" ||
      position.finger === "TB",
  );
}

export function convertToMana2LayoutFile(layout: LayoutDoc): Mana2LayoutFile {
  interface PlacedKey {
    character: string;
    row: number;
    col: number;
    finger: string;
  }

  const mainKeys: PlacedKey[] = [];
  const thumbKeys: PlacedKey[] = [];
  let maxRow = -1;
  let maxCol = -1;

  for (const [character, key] of Object.entries(layout.keys)) {
    if (key.finger === "LT" || key.finger === "RT" || key.finger === "TB") {
      thumbKeys.push({
        character,
        row: key.row,
        col: key.col,
        finger: physicalThumbSide(layout.board, key.finger, key.col),
      });
      continue;
    }

    maxRow = Math.max(maxRow, key.row);
    maxCol = Math.max(maxCol, key.col);
    mainKeys.push({
      character,
      row: key.row,
      col: key.col,
      finger: key.finger,
    });
  }

  const numRows = maxRow + 1;
  const numCols = maxCol + 1;
  const charGrid = Array.from({ length: numRows }, () =>
    Array.from({ length: numCols }, () => ""),
  );
  const fingerGrid = Array.from({ length: numRows }, () =>
    Array.from({ length: numCols }, () => ""),
  );

  for (const key of mainKeys) {
    const fingerIndex = FINGER_INDEX[key.finger];
    if (fingerIndex === undefined) continue;
    charGrid[key.row][key.col] = key.character;
    fingerGrid[key.row][key.col] = String(fingerIndex);
  }

  const fingers = charGrid.map((row) =>
    row.map((cell) => gridToken(cell)).join(" "),
  );
  const fingermap = fingerGrid.map((row) =>
    row.map((cell) => cell || "0").join(" "),
  );

  thumbKeys.sort((a, b) => (a.col === b.col ? a.row - b.row : a.col - b.col));

  const leftThumb: string[] = [];
  const rightThumb: string[] = [];
  for (const key of thumbKeys) {
    const token = gridToken(key.character);
    if (key.finger === "LT") {
      leftThumb.push(token);
    } else {
      rightThumb.push(token);
    }
  }

  const board = mana2Board(layout.board);

  const file: Mana2LayoutFile = {
    layout: {
      fingers,
      thumbs: [leftThumb.join(" "), rightThumb.join(" ")],
    },
    fingermap,
    board: {
      isRowStaggered: true,
      mirrorLeftRowStagger: false,
      splitAngle: 0,
      rowOrColumnStagger: rowStagger(board, numRows),
    },
  };

  if (layout.magic?.length) {
    file.magic = {
      magicKeys: null,
      rules: layout.magic.map((rule) => ({
        inputs: rule.inputs,
        output: rule.output,
      })),
    };
  }

  return file;
}
