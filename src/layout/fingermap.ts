import type { BoardType } from "./board.js";
import type { LayoutDoc, LayoutPosition } from "./types.js";

export const FINGER_DIGITS = "0123456789";

export const FINGER_FROM_DIGIT: Record<string, string> = {
  "0": "LP",
  "1": "LR",
  "2": "LM",
  "3": "LI",
  "4": "LT",
  "5": "RT",
  "6": "RI",
  "7": "RM",
  "8": "RR",
  "9": "RP",
};

const FMAP_STANDARD = [
  "LP",
  "LR",
  "LM",
  "LI",
  "LI",
  "RI",
  "RI",
  "RM",
  "RR",
  "RP",
] as const;

const FMAP_ANGLE = [
  "LR",
  "LM",
  "LI",
  "LI",
  "LI",
  "RI",
  "RI",
  "RM",
  "RR",
  "RP",
] as const;

export class FingermapParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FingermapParseError";
  }
}

export function fingerForCell(
  board: BoardType,
  row: number,
  col: number,
): string {
  if (row >= 3) {
    return col < 5 ? "LT" : "RT";
  }

  const fmap = board === "angle" && row === 2 ? FMAP_ANGLE : FMAP_STANDARD;
  return fmap[Math.min(col, fmap.length - 1)]!;
}

export function layoutGridDimensions(
  keys: Record<string, LayoutPosition>,
): { rows: number; cols: number } {
  let maxRow = -1;
  let maxCol = -1;

  for (const position of Object.values(keys)) {
    maxRow = Math.max(maxRow, position.row);
    maxCol = Math.max(maxCol, position.col);
  }

  if (maxRow < 0 || maxCol < 0) {
    throw new FingermapParseError("Layout has no keys.");
  }

  return { rows: maxRow + 1, cols: maxCol + 1 };
}

function fingerFromDigit(digit: string): string {
  if (!/^[0-9]$/.test(digit)) {
    throw new FingermapParseError(
      `Invalid finger \`${digit}\`. Use digits 0–9.`,
    );
  }

  const finger = FINGER_FROM_DIGIT[digit];
  if (!finger) {
    throw new FingermapParseError(`Unknown finger digit \`${digit}\`.`);
  }

  return finger;
}

export function parseFingerGrid(matrix: string): string[][] {
  const lines: string[] = [];

  for (const rawLine of matrix.split("\n")) {
    if (rawLine.trim() === "") {
      continue;
    }

    if (rawLine !== rawLine.trimStart()) {
      throw new FingermapParseError(
        "Rows must not be indented. Separate finger digits with spaces.",
      );
    }

    lines.push(rawLine.trim());
  }

  if (lines.length === 0) {
    throw new FingermapParseError("Finger grid is empty.");
  }

  const grid = lines.map((line) => line.split(/\s+/).filter(Boolean));
  const width = grid[0]!.length;

  if (width === 0) {
    throw new FingermapParseError(
      "Finger grid rows must contain at least one value.",
    );
  }

  for (let row = 0; row < grid.length; row++) {
    const rowWidth = grid[row]!.length;
    if (rowWidth !== width) {
      throw new FingermapParseError(
        `Row ${row + 1} has ${rowWidth} column${rowWidth === 1 ? "" : "s"}; expected ${width}.`,
      );
    }
  }

  return grid;
}

export function applyDefaultBoard(
  layout: LayoutDoc,
  board: BoardType,
): LayoutDoc {
  layout.board = board;

  for (const position of Object.values(layout.keys)) {
    position.finger = fingerForCell(board, position.row, position.col);
  }

  return layout;
}

export function applyFingerGrid(
  layout: LayoutDoc,
  grid: string[][],
): LayoutDoc {
  const { rows, cols } = layoutGridDimensions(layout.keys);

  if (grid.length !== rows || grid[0]!.length !== cols) {
    throw new FingermapParseError(
      `Finger grid must be ${rows} row${rows === 1 ? "" : "s"} by ${cols} column${cols === 1 ? "" : "s"}.`,
    );
  }

  const keysByPosition = new Map<string, string>();
  for (const [character, position] of Object.entries(layout.keys)) {
    keysByPosition.set(`${position.row},${position.col}`, character);
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const digit = grid[row]![col]!;
      const finger = fingerFromDigit(digit);
      const character = keysByPosition.get(`${row},${col}`);

      if (character) {
        layout.keys[character]!.finger = finger;
      }
    }
  }

  return layout;
}
