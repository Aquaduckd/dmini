export const PREFIX = "!dmini ";

export const DEPRECATED_CMINI_PREFIXES = [
  "!amini",
  "!bmini",
  "!cmini",
  "!dvormini",
  "!cnini",
] as const;

export function matchDeprecatedCminiPrefix(content: string): string | null {
  const trimmed = content.trim().toLowerCase();

  for (const prefix of DEPRECATED_CMINI_PREFIXES) {
    if (trimmed === prefix || trimmed.startsWith(`${prefix} `)) {
      return prefix;
    }
  }

  return null;
}
