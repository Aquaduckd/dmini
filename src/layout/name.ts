const NAME_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-'():~";

const ALLOWED_NAME_CHARS = new Set(NAME_CHARS);

export class LayoutNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LayoutNameError";
  }
}

export function validateLayoutName(name: string): void {
  if (!name) {
    throw new LayoutNameError("Layout name is required.");
  }

  if (name.startsWith("_")) {
    throw new LayoutNameError("Names cannot start with an underscore.");
  }

  if (name.length < 3) {
    throw new LayoutNameError("Names must be at least 3 characters long.");
  }

  for (const character of name) {
    if (!ALLOWED_NAME_CHARS.has(character)) {
      throw new LayoutNameError(`Names cannot contain \`${character}\`.`);
    }
  }
}

export function normalizeLayoutName(parts: string[]): string {
  return parts.join("-").toLowerCase();
}
