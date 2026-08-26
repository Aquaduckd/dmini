import type { LayoutDoc, LayoutPosition } from "./types.js";

export class SwapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SwapError";
  }
}

function swapKeys(
  keys: Record<string, LayoutPosition>,
  left: string,
  right: string,
): void {
  const leftPos = keys[left]!;
  const rightPos = keys[right]!;

  keys[left] = {
    row: rightPos.row,
    col: rightPos.col,
    finger: rightPos.finger,
  };
  keys[right] = {
    row: leftPos.row,
    col: leftPos.col,
    finger: leftPos.finger,
  };
}

export function applySwaps(layout: LayoutDoc, pairs: string[]): LayoutDoc {
  for (const pair of pairs) {
    if (pair.length !== 2) {
      throw new SwapError(
        `Each swap must be exactly two letters, got \`${pair}\`.`,
      );
    }

    const [left, right] = pair;
    if (left === right) {
      throw new SwapError(`Cannot swap a letter with itself: \`${pair}\`.`);
    }

    if (!(left in layout.keys)) {
      throw new SwapError(`Layout has no key \`${left}\`.`);
    }

    if (!(right in layout.keys)) {
      throw new SwapError(`Layout has no key \`${right}\`.`);
    }

    swapKeys(layout.keys, left, right);
  }

  return layout;
}
