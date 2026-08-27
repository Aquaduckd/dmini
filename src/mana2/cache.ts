import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchLayoutDoc, listAllLayouts, type LayoutSummary } from "../api/layouts.js";
import { BOT_DEFAULT_CORPUS } from "../config/user.js";
import { isAnalyzableLayout, type LayoutDoc } from "../layout/types.js";
import { runMana2ForLayout, sanitizeTempName } from "./cli.js";
import { layoutHasMagicRules, layoutHasThumbKeys } from "./convert.js";
import { resolveDownloadedCorpus } from "./corpus.js";
import {
  analysisFromRecord,
  analysisToRecord,
  parseMana2Analysis,
  type Mana2Analysis,
} from "./parse.js";

export const ANALYZER_VERSION = 3;

const CACHE_DIR = path.resolve(process.cwd(), ".dmini", "cache");
const LAYOUT_CACHE_DIR = path.join(CACHE_DIR, "layouts");

export interface LayoutCacheEntry {
  layout: string;
  modified_at?: string;
  analyzer_version: number;
  has_magic?: boolean;
  has_thumbs?: boolean;
  corpora: Record<string, Record<string, number>>;
}

export interface CorpusIndex {
  corpus: string;
  analyzer_version: number;
  built_at: string;
  layouts: Record<string, Record<string, number>>;
}

export interface RankedLayout {
  name: string;
  value: number;
}

export interface WarmCacheResult {
  corpus: string;
  total: number;
  skipped: number;
  computed: number;
  failed: number;
  errors: Array<{ layout: string; message: string }>;
}

export interface CacheStatus {
  layoutFiles: number;
  corpora: string[];
}

export interface LayoutCacheVersionCounts {
  currentVersion: number;
  totalFiles: number;
  byVersion: Record<number, number>;
}

const inflight = new Map<string, Promise<Mana2Analysis>>();

function layoutCachePath(name: string): string {
  return path.join(LAYOUT_CACHE_DIR, `${sanitizeTempName(name)}.json`);
}

function cacheLookupKey(layoutName: string, corpus: string): string {
  return `${layoutName.toLowerCase()}:${corpus.toLowerCase()}`;
}

function isCorpusCacheValid(
  entry: LayoutCacheEntry,
  layout: Pick<LayoutDoc, "name" | "modified_at">,
  corpus: string,
): boolean {
  if (entry.analyzer_version !== ANALYZER_VERSION) return false;
  if (entry.layout.toLowerCase() !== layout.name.toLowerCase()) return false;
  if (
    layout.modified_at &&
    entry.modified_at &&
    entry.modified_at !== layout.modified_at
  ) {
    return false;
  }
  return findCorpusKey(entry, corpus) !== undefined;
}

function findCorpusKey(
  entry: LayoutCacheEntry,
  corpus: string,
): string | undefined {
  return Object.keys(entry.corpora).find(
    (key) => key.toLowerCase() === corpus.toLowerCase(),
  );
}

function corpusStats(
  entry: LayoutCacheEntry,
  corpus: string,
): Record<string, number> | undefined {
  const key = findCorpusKey(entry, corpus);
  return key ? entry.corpora[key] : undefined;
}

async function readLayoutCache(name: string): Promise<LayoutCacheEntry | null> {
  try {
    const raw = await readFile(layoutCachePath(name), "utf8");
    return JSON.parse(raw) as LayoutCacheEntry;
  } catch {
    return null;
  }
}

async function writeLayoutCache(entry: LayoutCacheEntry): Promise<void> {
  await mkdir(LAYOUT_CACHE_DIR, { recursive: true });
  await writeFile(
    layoutCachePath(entry.layout),
    `${JSON.stringify(entry, null, 2)}\n`,
    "utf8",
  );
}

async function listLayoutCacheFiles(): Promise<string[]> {
  try {
    return (await readdir(LAYOUT_CACHE_DIR)).filter((file) => file.endsWith(".json"));
  } catch {
    return [];
  }
}

async function readAllLayoutCacheEntries(): Promise<LayoutCacheEntry[]> {
  const files = await listLayoutCacheFiles();
  const entries: LayoutCacheEntry[] = [];

  for (const file of files) {
    try {
      const raw = await readFile(path.join(LAYOUT_CACHE_DIR, file), "utf8");
      entries.push(JSON.parse(raw) as LayoutCacheEntry);
    } catch {
      // ignore broken cache files
    }
  }

  return entries;
}

export async function getCachedLayoutStats(
  layout: Pick<LayoutDoc, "name" | "modified_at">,
  corpus: string,
): Promise<Mana2Analysis | null> {
  const entry = await readLayoutCache(layout.name);
  if (!entry || !isCorpusCacheValid(entry, layout, corpus)) {
    return null;
  }

  const stats = corpusStats(entry, corpus);
  return stats ? analysisFromRecord(stats) : null;
}

async function resolveCorpusName(corpus: string): Promise<string> {
  try {
    return await resolveDownloadedCorpus(corpus);
  } catch {
    return corpus.trim();
  }
}

export async function computeAndCacheLayoutStats(
  layout: LayoutDoc,
  corpus: string,
  options: { mana2Root?: string } = {},
): Promise<Mana2Analysis> {
  const raw = await runMana2ForLayout(layout, "json {layout}", {
    ...options,
    corpus,
  });
  const analysis = parseMana2Analysis(raw);
  const stats = analysisToRecord(analysis);

  const existing = await readLayoutCache(layout.name);
  const entry: LayoutCacheEntry = existing ?? {
    layout: layout.name,
    modified_at: layout.modified_at,
    analyzer_version: ANALYZER_VERSION,
    corpora: {},
  };

  entry.layout = layout.name;
  entry.modified_at = layout.modified_at;
  entry.analyzer_version = ANALYZER_VERSION;
  entry.has_magic = layoutHasMagicRules(layout);
  entry.has_thumbs = layoutHasThumbKeys(layout);
  entry.corpora[corpus] = stats;

  await writeLayoutCache(entry);

  return analysis;
}

export async function getLayoutStats(
  layout: LayoutDoc,
  corpus: string,
  options: { mana2Root?: string } = {},
): Promise<Mana2Analysis> {
  const cached = await getCachedLayoutStats(layout, corpus);
  if (cached) return cached;

  const resolvedCorpus = await resolveDownloadedCorpus(corpus);
  const key = cacheLookupKey(layout.name, resolvedCorpus);
  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = computeAndCacheLayoutStats(layout, resolvedCorpus, options).finally(
    () => {
      inflight.delete(key);
    },
  );

  inflight.set(key, promise);
  return promise;
}

export async function getCorpusStatsIndex(
  corpus: string,
): Promise<CorpusIndex | null> {
  const resolvedCorpus = await resolveCorpusName(corpus);
  const entries = await readAllLayoutCacheEntries();
  const layouts: Record<string, Record<string, number>> = {};

  for (const entry of entries) {
    if (entry.analyzer_version !== ANALYZER_VERSION) continue;

    const stats = corpusStats(entry, resolvedCorpus);
    if (stats) {
      layouts[entry.layout] = stats;
    }
  }

  if (Object.keys(layouts).length === 0) {
    return null;
  }

  return {
    corpus: resolvedCorpus,
    analyzer_version: ANALYZER_VERSION,
    built_at: new Date().toISOString(),
    layouts,
  };
}

export function rankLayouts(
  index: CorpusIndex,
  statId: string,
  options: {
    ascending?: boolean;
    limit?: number;
    offset?: number;
  } = {},
): RankedLayout[] {
  const ranked = Object.entries(index.layouts)
    .map(([name, stats]) => ({
      name,
      value: stats[statId],
    }))
    .filter((entry): entry is RankedLayout => entry.value !== undefined)
    .sort((a, b) => {
      const diff = options.ascending ? a.value - b.value : b.value - a.value;
      return diff || a.name.localeCompare(b.name);
    });

  const offset = options.offset ?? 0;
  const limit = options.limit ?? ranked.length;
  return ranked.slice(offset, offset + limit);
}

export function layoutPercentile(
  index: CorpusIndex,
  statId: string,
  layoutName: string,
  options: { lowerIsBetter?: boolean } = {},
): number | null {
  const ranked = rankLayouts(index, statId, {
    ascending: options.lowerIsBetter ?? false,
  });

  const indexOf = ranked.findIndex(
    (entry) => entry.name.toLowerCase() === layoutName.toLowerCase(),
  );
  if (indexOf === -1 || ranked.length <= 1) return null;

  return (indexOf / (ranked.length - 1)) * 100;
}

export function getLayoutStatPercentile(
  index: CorpusIndex,
  layoutName: string,
  statId: string,
  options: { lowerIsBetter?: boolean } = {},
): number | null {
  return layoutPercentile(index, statId, layoutName, options);
}

export async function getLayoutStatFromIndex(
  corpus: string,
  layoutName: string,
  statId: string,
): Promise<number | undefined> {
  const entry = await readLayoutCache(layoutName);
  if (!entry || entry.analyzer_version !== ANALYZER_VERSION) {
    return undefined;
  }

  const resolvedCorpus = await resolveCorpusName(corpus);
  return corpusStats(entry, resolvedCorpus)?.[statId];
}

export async function getCacheStatus(): Promise<CacheStatus> {
  const files = await listLayoutCacheFiles();
  const entries = await readAllLayoutCacheEntries();
  const corpora = new Set<string>();

  for (const entry of entries) {
    if (entry.analyzer_version !== ANALYZER_VERSION) continue;
    for (const corpus of Object.keys(entry.corpora)) {
      corpora.add(corpus);
    }
  }

  return {
    layoutFiles: files.length,
    corpora: [...corpora].sort((a, b) => a.localeCompare(b)),
  };
}

export async function getLayoutCacheVersionCounts(): Promise<LayoutCacheVersionCounts> {
  const entries = await readAllLayoutCacheEntries();
  const byVersion: Record<number, number> = {};

  for (const entry of entries) {
    const version = entry.analyzer_version ?? 0;
    byVersion[version] = (byVersion[version] ?? 0) + 1;
  }

  return {
    currentVersion: ANALYZER_VERSION,
    totalFiles: entries.length,
    byVersion,
  };
}

export async function clearAnalysisCache(
  layoutName?: string,
): Promise<{ layoutFiles: number }> {
  if (layoutName?.trim()) {
    const name = layoutName.trim();
    await rm(layoutCachePath(name), { force: true });
    return { layoutFiles: 1 };
  }

  await rm(LAYOUT_CACHE_DIR, { force: true, recursive: true });
  await rm(path.join(CACHE_DIR, "index"), { force: true, recursive: true });
  return { layoutFiles: 0 };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}

function isSummaryCacheValid(
  entry: LayoutCacheEntry | null,
  summary: LayoutSummary,
  corpus: string,
): boolean {
  if (!entry) return false;
  return isCorpusCacheValid(
    entry,
    { name: summary.name, modified_at: summary.modified_at },
    corpus,
  );
}

export async function warmAnalysisCache(
  options: {
    corpus?: string;
    concurrency?: number;
  } = {},
): Promise<WarmCacheResult[]> {
  const concurrency = options.concurrency ?? 2;
  const corpora = options.corpus
    ? [await resolveDownloadedCorpus(options.corpus)]
    : [await resolveDownloadedCorpus(BOT_DEFAULT_CORPUS)];

  const summaries = (await listAllLayouts()).filter(
    (summary) => (summary.key_count ?? 0) > 0,
  );

  const results: WarmCacheResult[] = [];

  for (const corpus of corpora) {
    const result: WarmCacheResult = {
      corpus,
      total: summaries.length,
      skipped: 0,
      computed: 0,
      failed: 0,
      errors: [],
    };

    await mapWithConcurrency(summaries, concurrency, async (summary) => {
      const cached = await readLayoutCache(summary.name);
      if (isSummaryCacheValid(cached, summary, corpus)) {
        result.skipped++;
        return;
      }

      try {
        const layout = await fetchLayoutDoc(summary.name);
        if (Object.keys(layout.keys).length === 0 || !isAnalyzableLayout(layout)) {
          result.skipped++;
          return;
        }

        await computeAndCacheLayoutStats(layout, corpus);
        result.computed++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          layout: summary.name,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });

    results.push(result);
  }

  return results;
}

export async function listCurrentVersionCacheEntries(): Promise<LayoutCacheEntry[]> {
  const entries = await readAllLayoutCacheEntries();
  return entries.filter((entry) => entry.analyzer_version === ANALYZER_VERSION);
}
