import type { LayoutDoc, LayoutPosition } from "./types.js";

export class SwapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SwapError";
  }
}

function cycleCharacters(cycle: string): string[] {
  return [...cycle];
}

function validateCycle(cycle: string, keys: Record<string, LayoutPosition>): string[] {
  const chars = cycleCharacters(cycle);

  if (chars.length < 2) {
    throw new SwapError(
      `Each cycle must have at least two characters, got \`${cycle}\`.`,
    );
  }

  if (new Set(chars).size !== chars.length) {
    throw new SwapError(
      `Cannot use duplicate characters in cycle \`${cycle}\`.`,
    );
  }

  const missing = chars.filter((character) => !(character in keys));
  if (missing.length > 1) {
    const listed = missing.map((character) => `\`${character}\``).join(", ");
    throw new SwapError(
      `Cycle \`${cycle}\` has multiple characters not on the layout: ${listed}.`,
    );
  }

  if (missing.length === chars.length) {
    throw new SwapError(`Cycle \`${cycle}\` has no characters on the layout.`);
  }

  return chars;
}

function applyCycle(
  keys: Record<string, LayoutPosition>,
  cycle: string,
): void {
  const chars = validateCycle(cycle, keys);

  const successor = new Map<string, string>();
  for (let index = 0; index < chars.length; index++) {
    successor.set(chars[index]!, chars[(index + 1) % chars.length]!);
  }

  const keymap: Record<string, LayoutPosition> = {};
  for (const character of chars) {
    if (character in keys) {
      keymap[character] = { ...keys[character]! };
    }
  }

  const toDelete: string[] = [];
  const toSet: Record<string, LayoutPosition> = {};

  for (const character of chars) {
    const next = successor.get(character)!;

    if (character in keymap) {
      if (next in keymap) {
        toSet[character] = { ...keymap[next]! };
      } else {
        toDelete.push(character);
      }
      continue;
    }

    if (next in keymap) {
      toSet[character] = { ...keymap[next]! };
    }
  }

  for (const character of toDelete) {
    delete keys[character];
  }

  for (const [character, position] of Object.entries(toSet)) {
    keys[character] = position;
  }
}

export function applySwaps(layout: LayoutDoc, cycles: string[]): LayoutDoc {
  for (const cycle of cycles) {
    applyCycle(layout.keys, cycle);
  }

  return layout;
}
