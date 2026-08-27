import {
  type CorpusIndex,
  type LayoutCacheEntry,
  listCurrentVersionCacheEntries,
  rankLayouts,
} from "./cache.js";
import { resolveDownloadedCorpus } from "./corpus.js";
import {
  percentileScoreFromCutoffs,
  requireResolvedCorpusPercentileCutoffs,
} from "./percentiles.js";
import {
  formatLeaderboardOverallValue,
  formatLeaderboardStatValue,
  getStatDefinition,
  isLowerIsBetter,
  OVERALL_LEADERBOARD_STATS,
  type StatDefinition,
} from "./stats.js";

export type LayoutLeaderboardFilter = "all" | "magic" | "thumb" | "regular";

export interface LeaderboardEntry {
  name: string;
  value: number;
}

export interface LeaderboardResult {
  corpus: string;
  filter: LayoutLeaderboardFilter;
  mode: "stat" | "overall";
  stat?: StatDefinition;
  layoutCount: number;
  totalEntries: number;
  entries: LeaderboardEntry[];
  overallStatCount?: number;
}

function findCorpusKey(
  entry: LayoutCacheEntry,
  corpus: string,
): string | undefined {
  return Object.keys(entry.corpora).find(
    (key) => key.toLowerCase() === corpus.toLowerCase(),
  );
}

function layoutMetadata(
  entry: LayoutCacheEntry,
  stats: Record<string, number>,
): { hasMagic: boolean; hasThumbs: boolean } {
  const hasThumbs =
    entry.has_thumbs ??
    ((stats["finger-usage-LT"] ?? 0) > 0 || (stats["finger-usage-RT"] ?? 0) > 0);

  return {
    hasMagic: entry.has_magic ?? false,
    hasThumbs,
  };
}

function matchesFilter(
  metadata: { hasMagic: boolean; hasThumbs: boolean },
  filter: LayoutLeaderboardFilter,
): boolean {
  switch (filter) {
    case "magic":
      return metadata.hasMagic;
    case "thumb":
      return metadata.hasThumbs;
    case "regular":
      return !metadata.hasMagic && !metadata.hasThumbs;
    default:
      return true;
  }
}

async function buildFilteredCorpusIndex(
  corpus: string,
  filter: LayoutLeaderboardFilter,
): Promise<CorpusIndex | null> {
  const resolvedCorpus = await resolveDownloadedCorpus(corpus);
  const entries = await listCurrentVersionCacheEntries();
  const layouts: Record<string, Record<string, number>> = {};

  for (const entry of entries) {
    const corpusKey = findCorpusKey(entry, resolvedCorpus);
    if (!corpusKey) continue;

    const stats = entry.corpora[corpusKey]!;
    if (!matchesFilter(layoutMetadata(entry, stats), filter)) continue;

    layouts[entry.layout] = stats;
  }

  if (Object.keys(layouts).length === 0) {
    return null;
  }

  return {
    corpus: resolvedCorpus,
    analyzer_version: entries[0]?.analyzer_version ?? 0,
    built_at: new Date().toISOString(),
    layouts,
  };
}

function rankByOverall(
  index: CorpusIndex,
  cutoffs: Record<string, number[]>,
  options: { limit: number; offset: number },
): { entries: LeaderboardEntry[]; statCount: number } {
  const overallStats = OVERALL_LEADERBOARD_STATS.filter(
    (stat) => cutoffs[stat.id]?.length,
  );
  const averages: LeaderboardEntry[] = [];

  for (const [name, stats] of Object.entries(index.layouts)) {
    const scores: number[] = [];

    for (const stat of overallStats) {
      const raw = stats[stat.id];
      if (raw === undefined) continue;

      const score = percentileScoreFromCutoffs(cutoffs[stat.id]!, raw, {
        lowerIsBetter: isLowerIsBetter(stat.id),
      });
      if (score !== null) {
        scores.push(score);
      }
    }

    if (scores.length === 0) continue;

    const value =
      scores.reduce((sum, score) => sum + score, 0) / scores.length;
    averages.push({ name, value });
  }

  averages.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  return {
    entries: averages.slice(options.offset, options.offset + options.limit),
    statCount: overallStats.length,
  };
}

export async function buildLeaderboard(options: {
  corpus: string;
  filter: LayoutLeaderboardFilter;
  statId?: string;
  limit: number;
  offset: number;
}): Promise<LeaderboardResult | null> {
  const index = await buildFilteredCorpusIndex(options.corpus, options.filter);
  if (!index) return null;

  const layoutCount = Object.keys(index.layouts).length;

  if (options.statId) {
    const stat = getStatDefinition(options.statId);
    if (!stat) {
      throw new Error(`Unknown stat \`${options.statId}\`.`);
    }

    const allRanked = rankLayouts(index, options.statId, {
      ascending: isLowerIsBetter(options.statId),
    });
    const ranked = allRanked.slice(
      options.offset,
      options.offset + options.limit,
    );

    return {
      corpus: index.corpus,
      filter: options.filter,
      mode: "stat",
      stat,
      layoutCount,
      totalEntries: allRanked.length,
      entries: ranked,
    };
  }

  const cutoffTable = await requireResolvedCorpusPercentileCutoffs(
    options.corpus,
  );
  const allRanked = rankByOverall(index, cutoffTable.stats, {
    limit: Number.MAX_SAFE_INTEGER,
    offset: 0,
  });
  const pageEntries = allRanked.entries.slice(
    options.offset,
    options.offset + options.limit,
  );

  return {
    corpus: index.corpus,
    filter: options.filter,
    mode: "overall",
    layoutCount,
    totalEntries: allRanked.entries.length,
    entries: pageEntries,
    overallStatCount: allRanked.statCount,
  };
}

export function formatLeaderboardValue(
  result: LeaderboardResult,
  value: number,
): string {
  if (result.mode === "overall") {
    return formatLeaderboardOverallValue(value);
  }

  return formatLeaderboardStatValue(result.stat!, value);
}

export function leaderboardFilterLabel(filter: LayoutLeaderboardFilter): string {
  switch (filter) {
    case "magic":
      return "magic";
    case "thumb":
      return "thumb";
    case "regular":
      return "regular";
    default:
      return "all layouts";
  }
}
