export interface StatDefinition {
  id: string;
  label: string;
  percent?: boolean;
  decimals?: number;
}

const FINGER_STATS: StatDefinition[] = [
  { id: "finger-usage-LP", label: "LP", percent: true },
  { id: "finger-usage-LR", label: "LR", percent: true },
  { id: "finger-usage-LM", label: "LM", percent: true },
  { id: "finger-usage-LI", label: "LI", percent: true },
  { id: "finger-usage-RP", label: "RP", percent: true },
  { id: "finger-usage-RR", label: "RR", percent: true },
  { id: "finger-usage-RM", label: "RM", percent: true },
  { id: "finger-usage-RI", label: "RI", percent: true },
  { id: "finger-usage-LT", label: "LT", percent: true },
  { id: "finger-usage-RT", label: "RT", percent: true },
];

const BIGRAM_STATS: StatDefinition[] = [
  { id: "sfb", label: "SFB", percent: true, decimals: 2 },
  { id: "sfs", label: "SFS", percent: true, decimals: 2 },
  { id: "skb", label: "SKB", percent: true, decimals: 2 },
  { id: "lsb", label: "LSB", decimals: 2 },
  { id: "vsb", label: "VSB", decimals: 2 },
];

const TRIGRAM_STATS: StatDefinition[] = [
  { id: "alt", label: "Alt", percent: true, decimals: 2 },
  { id: "roll", label: "Roll", percent: true, decimals: 2 },
  { id: "inroll2", label: "In2", percent: true, decimals: 2 },
  { id: "outroll2", label: "Out2", percent: true, decimals: 2 },
  { id: "inroll3", label: "In3", percent: true, decimals: 2 },
  { id: "outroll3", label: "Out3", percent: true, decimals: 2 },
  { id: "altsfs", label: "Alt+SFS", percent: true, decimals: 2 },
  { id: "redirectsfs", label: "RdSF", percent: true, decimals: 2 },
  { id: "redirect", label: "Rdr", percent: true, decimals: 2 },
  { id: "redirectweak", label: "WRd", percent: true, decimals: 2 },
];

export const ALL_STATS: StatDefinition[] = [
  ...FINGER_STATS,
  ...BIGRAM_STATS,
  ...TRIGRAM_STATS,
];

export const OVERALL_LEADERBOARD_STATS: StatDefinition[] = [
  ...BIGRAM_STATS,
  ...TRIGRAM_STATS,
];

const STAT_BY_ID = new Map(ALL_STATS.map((stat) => [stat.id, stat]));

const STAT_ALIASES = new Map<string, string>([
  ...ALL_STATS.map((stat) => [stat.id.toLowerCase(), stat.id] as const),
  ...ALL_STATS.map((stat) => [stat.label.toLowerCase(), stat.id] as const),
  ["in2", "inroll2"],
  ["out2", "outroll2"],
  ["in3", "inroll3"],
  ["out3", "outroll3"],
  ["altsfs", "altsfs"],
  ["rdsf", "redirectsfs"],
  ["rdr", "redirect"],
  ["wrd", "redirectweak"],
]);

const LOWER_IS_BETTER_STATS = new Set([
  "sfb",
  "sfs",
  "skb",
  "lsb",
  "vsb",
  "alt",
  "altsfs",
  "redirect",
  "redirectweak",
  "redirectsfs",
]);

const HIGHER_IS_BETTER_STATS = new Set([
  "roll",
  "inroll2",
  "outroll2",
  "inroll3",
  "outroll3",
]);

export function resolveStatId(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;

  const alias = STAT_ALIASES.get(normalized);
  if (alias) return alias;

  return STAT_BY_ID.has(normalized) ? normalized : null;
}

export function getStatDefinition(statId: string): StatDefinition | undefined {
  return STAT_BY_ID.get(statId);
}

export function isLowerIsBetter(statId: string): boolean {
  if (LOWER_IS_BETTER_STATS.has(statId)) return true;
  if (HIGHER_IS_BETTER_STATS.has(statId)) return false;
  if (statId.startsWith("finger-usage-")) return true;
  return false;
}

export function formatLeaderboardStatValue(
  stat: StatDefinition,
  value: number,
): string {
  if (stat.percent) {
    if (value >= 99.95) {
      return `${Math.round(value)}%`;
    }
    return `${value.toFixed(stat.decimals ?? 1)}%`;
  }
  return value.toFixed(stat.decimals ?? 2);
}

export function formatLeaderboardOverallValue(value: number): string {
  return value.toFixed(1);
}
