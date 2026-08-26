import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PREFIX } from "../command/constants.js";
import { BOT_DEFAULT_CORPUS } from "../config/user.js";
import {
  ANALYZER_VERSION,
  getCorpusStatsIndex,
  type CorpusIndex,
} from "./cache.js";
import { sanitizeTempName } from "./cli.js";
import { resolveDownloadedCorpus } from "./corpus.js";

export const PERCENTILE_BUCKET_COUNT = 100;

const PERCENTILE_CACHE_DIR = path.resolve(
  process.cwd(),
  ".dmini",
  "cache",
  "percentiles",
);

export interface CorpusPercentileCutoffs {
  corpus: string;
  analyzer_version: number;
  built_at: string;
  layout_count: number;
  stats: Record<string, number[]>;
}

function percentileCachePath(corpus: string): string {
  return path.join(PERCENTILE_CACHE_DIR, `${sanitizeTempName(corpus)}.json`);
}

export function buildPercentileCutoffs(
  values: number[],
  bucketCount = PERCENTILE_BUCKET_COUNT,
): number[] {
  if (values.length === 0) return [];
  if (values.length === 1) {
    return Array.from({ length: bucketCount }, () => values[0]!);
  }

  const sorted = [...values].sort((a, b) => a - b);
  const cutoffs: number[] = [];

  for (let index = 0; index < bucketCount; index++) {
    const rank = (index / (bucketCount - 1)) * (sorted.length - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    const weight = rank - lower;
    cutoffs.push(sorted[lower]! * (1 - weight) + sorted[upper]! * weight);
  }

  return cutoffs;
}

export function percentileFromCutoffs(
  cutoffs: number[],
  value: number,
): number | null {
  if (cutoffs.length === 0) return null;

  let lo = 0;
  let hi = cutoffs.length - 1;
  let bucket = 0;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cutoffs[mid]! <= value) {
      bucket = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return bucket;
}

export function buildCorpusPercentileCutoffs(
  index: CorpusIndex,
): Record<string, number[]> {
  const valuesByStat = new Map<string, number[]>();

  for (const stats of Object.values(index.layouts)) {
    for (const [statId, value] of Object.entries(stats)) {
      const bucket = valuesByStat.get(statId) ?? [];
      bucket.push(value);
      valuesByStat.set(statId, bucket);
    }
  }

  const cutoffs: Record<string, number[]> = {};

  for (const [statId, values] of valuesByStat) {
    const statCutoffs = buildPercentileCutoffs(values);
    if (statCutoffs.length > 0) {
      cutoffs[statId] = statCutoffs;
    }
  }

  return cutoffs;
}

export async function loadCorpusPercentileCutoffs(
  corpus: string,
): Promise<CorpusPercentileCutoffs | null> {
  try {
    const raw = await readFile(percentileCachePath(corpus), "utf8");
    const parsed = JSON.parse(raw) as CorpusPercentileCutoffs;
    if (parsed.analyzer_version !== ANALYZER_VERSION) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCorpusPercentileCutoffs(
  table: CorpusPercentileCutoffs,
): Promise<string> {
  await mkdir(PERCENTILE_CACHE_DIR, { recursive: true });
  const filePath = percentileCachePath(table.corpus);
  await writeFile(filePath, `${JSON.stringify(table, null, 2)}\n`, "utf8");
  return filePath;
}

export async function computeCorpusPercentileCutoffs(
  corpus = BOT_DEFAULT_CORPUS,
): Promise<CorpusPercentileCutoffs> {
  const resolvedCorpus = await resolveDownloadedCorpus(corpus);
  const index = await getCorpusStatsIndex(resolvedCorpus);

  if (!index) {
    throw new Error(
      `No cached stats found for corpus \`${resolvedCorpus}\`. Run \`${PREFIX}debug cache warm ${resolvedCorpus}\` first.`,
    );
  }

  const stats = buildCorpusPercentileCutoffs(index);

  if (Object.keys(stats).length === 0) {
    throw new Error(`No stats available to build percentiles for \`${resolvedCorpus}\`.`);
  }

  return {
    corpus: resolvedCorpus,
    analyzer_version: ANALYZER_VERSION,
    built_at: new Date().toISOString(),
    layout_count: Object.keys(index.layouts).length,
    stats,
  };
}

export async function buildAndSaveCorpusPercentileCutoffs(
  corpus = BOT_DEFAULT_CORPUS,
): Promise<{ table: CorpusPercentileCutoffs; filePath: string }> {
  const table = await computeCorpusPercentileCutoffs(corpus);
  const filePath = await saveCorpusPercentileCutoffs(table);
  return { table, filePath };
}

export async function clearPercentileCutoffs(corpus?: string): Promise<void> {
  if (corpus?.trim()) {
    await rm(percentileCachePath(corpus.trim()), { force: true });
    return;
  }

  await rm(PERCENTILE_CACHE_DIR, { force: true, recursive: true });
}

export async function ensureCorpusPercentileCutoffs(
  corpus = BOT_DEFAULT_CORPUS,
): Promise<CorpusPercentileCutoffs> {
  const resolvedCorpus = await resolveDownloadedCorpus(corpus);
  const existing = await loadCorpusPercentileCutoffs(resolvedCorpus);
  if (existing) return existing;

  const { table } = await buildAndSaveCorpusPercentileCutoffs(resolvedCorpus);
  return table;
}

export async function layoutStatPercentileFromCutoffs(
  corpus: string,
  layoutName: string,
  statId: string,
): Promise<number | null> {
  const resolvedCorpus = await resolveDownloadedCorpus(corpus);
  const table = await loadCorpusPercentileCutoffs(resolvedCorpus);
  if (!table) return null;

  const cutoffs = table.stats[statId];
  if (!cutoffs) return null;

  const index = await getCorpusStatsIndex(resolvedCorpus);
  const value = index?.layouts[layoutName]?.[statId];
  if (value === undefined) return null;

  return percentileFromCutoffs(cutoffs, value);
}
