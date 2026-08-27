export const PREFIX = "!dmini ";

// Prefixes the bot answers to. PREFIX is canonical and the only one shown in
// help text, usage strings and examples; the rest are accepted separately.
const PREFIXES = [PREFIX, "!dnini "];

// Returns the content following whichever prefix matched, or null if none did.
// The match is the only place prefix spelling matters — everything downstream
// works on the remainder.
export function stripPrefix(content: string): string | null {
  for (const prefix of PREFIXES) {
    if (content.startsWith(prefix)) {
      return content.slice(prefix.length);
    }
  }

  return null;
}
