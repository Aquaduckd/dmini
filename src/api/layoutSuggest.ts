import { listAllLayouts } from "./layouts.js";

const MIN_SIMILARITY = 0.72;
const MAX_SUGGESTIONS = 3;

let layoutNamesCache: string[] | null = null;
let layoutNamesPromise: Promise<string[]> | null = null;

async function loadLayoutNames(): Promise<string[]> {
  if (layoutNamesCache) return layoutNamesCache;

  layoutNamesPromise ??= listAllLayouts().then((layouts) => {
    layoutNamesCache = layouts.map((layout) => layout.name);
    return layoutNamesCache;
  });

  return layoutNamesPromise;
}

export function normalizeLayoutName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalize(name: string): string {
  return normalizeLayoutName(name);
}

export function layoutMatchesSearch(name: string, query: string): boolean {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return false;
  return normalize(name).includes(normalizedQuery);
}

function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i++) dist[i]![0] = i;
  for (let j = 0; j < cols; j++) dist[0]![j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i]![j] = Math.min(
        dist[i - 1]![j]! + 1,
        dist[i]![j - 1]! + 1,
        dist[i - 1]![j - 1]! + cost,
      );

      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        dist[i]![j] = Math.min(dist[i]![j]!, dist[i - 2]![j - 2]! + 1);
      }
    }
  }

  return dist[a.length]![b.length]!;
}

function similarity(query: string, name: string): number {
  const normalizedQuery = normalize(query);
  const normalizedName = normalize(name);

  if (!normalizedQuery || !normalizedName) return 0;
  if (normalizedQuery === normalizedName) return 1;

  const shorter = Math.min(normalizedQuery.length, normalizedName.length);
  const longer = Math.max(normalizedQuery.length, normalizedName.length);

  if (normalizedName.includes(normalizedQuery)) {
    return 0.85 + (shorter / longer) * 0.15;
  }

  return 1 - damerauLevenshtein(normalizedQuery, normalizedName) / longer;
}

export async function suggestLayouts(
  query: string,
  limit = MAX_SUGGESTIONS,
): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const names = await loadLayoutNames();
  const ranked = names
    .map((name) => ({ name, score: similarity(trimmed, name) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  if (ranked.length === 0) return [];

  const best = ranked[0]!.name;
  const strongMatches = ranked
    .filter(({ score }) => score >= MIN_SIMILARITY)
    .map(({ name }) => name);

  const suggestions =
    strongMatches.length > 0 ? strongMatches : [best];

  return suggestions.slice(0, limit);
}

export function formatLayoutNotFoundMessage(
  name: string,
  suggestions: string[],
): string {
  let message = `Layout not found: \`${name}\``;

  if (suggestions.length === 1) {
    message += `\nDid you mean \`${suggestions[0]}\`?`;
  } else if (suggestions.length > 1) {
    message += `\nDid you mean ${suggestions.map((suggestion) => `\`${suggestion}\``).join(", ")}?`;
  }

  return message;
}
