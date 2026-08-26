import type { BoardType } from "./board.js";
import type { LayoutDoc, LayoutPosition } from "./types.js";
import { fingerForCell } from "./fingermap.js";

export const FREE_CHAR = "~";

const MAX_ROWS = 4;

export class MatrixParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MatrixParseError";
  }
}

export function parseLayoutMatrix(
  matrix: string,
  board: BoardType,
): Pick<LayoutDoc, "keys"> {
  const lines: string[] = [];

  for (const rawLine of matrix.split("\n")) {
    if (rawLine.trim() === "") {
      continue;
    }

    if (rawLine !== rawLine.trimStart()) {
      throw new MatrixParseError(
        "Rows must not be indented. Use `~` for empty keys.",
      );
    }

    lines.push(rawLine.trim());
  }

  if (lines.length === 0) {
    throw new MatrixParseError("Matrix is empty.");
  }

  if (lines.length > MAX_ROWS) {
    throw new MatrixParseError(`Matrix has too many rows (max ${MAX_ROWS}).`);
  }

  const grid = lines.map((line) => line.split(/\s+/).filter(Boolean));
  const width = grid[0]!.length;

  if (width === 0) {
    throw new MatrixParseError("Matrix rows must contain at least one key.");
  }

  for (let row = 0; row < grid.length; row++) {
    const rowWidth = grid[row]!.length;
    if (rowWidth !== width) {
      throw new MatrixParseError(
        `Row ${row + 1} has ${rowWidth} column${rowWidth === 1 ? "" : "s"}; expected ${width}.`,
      );
    }
  }

  const keys: Record<string, LayoutPosition> = {};

  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < width; col++) {
      const token = grid[row]![col]!;

      if (token === FREE_CHAR) {
        continue;
      }

      if (token.length !== 1) {
        throw new MatrixParseError(
          `Invalid key \`${token}\`. Each key must be one character or \`${FREE_CHAR}\`.`,
        );
      }

      if (token in keys) {
        throw new MatrixParseError(`Key \`${token}\` is defined twice.`);
      }

      keys[token] = {
        row,
        col,
        finger: fingerForCell(board, row, col),
      };
    }
  }

  if (Object.keys(keys).length === 0) {
    throw new MatrixParseError("Matrix has no keys.");
  }

  return { keys };
}
