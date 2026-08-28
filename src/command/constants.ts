export const DMINI_PREFIX = "!dmini";
export const PREFIX = `${DMINI_PREFIX} `;

export const DEPRECATED_CMINI_PREFIXES = [
  "!amini",
  "!bmini",
  "!cmini",
  "!dvormini",
  "!cnini",
] as const;

export function stripIncomingPrefix(content: string, dm: boolean): string | null {
  const trimmed = content.trimStart();

  if (trimmed.startsWith(PREFIX)) {
    return trimmed.slice(PREFIX.length).trim();
  }

  if (!dm) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith(DMINI_PREFIX)) {
    return trimmed.slice(DMINI_PREFIX.length).trim();
  }

  if (trimmed.startsWith("!")) {
    return trimmed.slice(1).trim();
  }

  return trimmed.trim();
}

export function matchDeprecatedCminiPrefix(content: string): string | null {
  const trimmed = content.trim().toLowerCase();

  for (const prefix of DEPRECATED_CMINI_PREFIXES) {
    if (trimmed === prefix || trimmed.startsWith(`${prefix} `)) {
      return prefix;
    }
  }

  return null;
}
