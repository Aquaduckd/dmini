import { createReadStream } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { PREFIX } from "../command/constants.js";
import { defaultMana2Root } from "./cli.js";
import { CorpusError } from "./corpus.js";

export interface WordWithFreq {
  word: string;
  frequency: number;
}

export interface CorpusSearchResult {
  matches: WordWithFreq[];
  matchTokens: number;
  totalTokens: number;
}

interface CachedWordsFile {
  corpusname: string;
  data: Array<{ w: string; f: number }>;
}

const wordsCache = new Map<string, WordWithFreq[]>();

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function mana2WordsCachePath(mana2Root: string, corpus: string): string {
  return path.join(
    mana2Root,
    "data",
    "corpus_parsed",
    "words_with_freqs",
    corpus,
  );
}

function dminiWordsCachePath(corpus: string): string {
  return path.resolve(
    process.cwd(),
    ".dmini",
    "cache",
    "corpus-words",
    `${corpus}.json`,
  );
}

function sortWordsByFrequency(words: WordWithFreq[]): WordWithFreq[] {
  return [...words].sort((a, b) => b.frequency - a.frequency);
}

async function loadMana2WordsCache(
  filePath: string,
): Promise<WordWithFreq[] | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as CachedWordsFile;
    if (!Array.isArray(parsed.data)) return null;

    return sortWordsByFrequency(
      parsed.data.map((entry) => ({
        word: entry.w,
        frequency: entry.f,
      })),
    );
  } catch {
    return null;
  }
}

async function buildWordsFromRawCorpus(
  rawPath: string,
): Promise<WordWithFreq[]> {
  const freqs = new Map<string, number>();
  const stream = createReadStream(rawPath, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of lines) {
    for (const word of line.trim().split(/\s+/)) {
      if (!word) continue;
      freqs.set(word, (freqs.get(word) ?? 0) + 1);
    }
  }

  return sortWordsByFrequency(
    [...freqs.entries()].map(([word, frequency]) => ({ word, frequency })),
  );
}

async function saveDminiWordsCache(
  corpus: string,
  words: WordWithFreq[],
): Promise<void> {
  const cachePath = dminiWordsCachePath(corpus);
  await mkdir(path.dirname(cachePath), { recursive: true });
  const payload: CachedWordsFile = {
    corpusname: corpus,
    data: words.map((entry) => ({ w: entry.word, f: entry.frequency })),
  };
  await writeFile(cachePath, `${JSON.stringify(payload)}\n`, "utf8");
}

export async function loadCorpusWords(
  corpus: string,
  options: { mana2Root?: string; isAdmin?: boolean } = {},
): Promise<WordWithFreq[]> {
  const cached = wordsCache.get(corpus);
  if (cached) return cached;

  const mana2Root = options.mana2Root ?? process.env.MANA2_ROOT ?? defaultMana2Root();

  const mana2CachePath = mana2WordsCachePath(mana2Root, corpus);
  if (await pathExists(mana2CachePath)) {
    const words = await loadMana2WordsCache(mana2CachePath);
    if (words) {
      wordsCache.set(corpus, words);
      return words;
    }
  }

  const dminiCachePath = dminiWordsCachePath(corpus);
  if (await pathExists(dminiCachePath)) {
    const words = await loadMana2WordsCache(dminiCachePath);
    if (words) {
      wordsCache.set(corpus, words);
      return words;
    }
  }

  const rawPath = path.join(mana2Root, "data", "corpus_raw", corpus);
  if (!(await pathExists(rawPath))) {
    throw new CorpusError(
      options.isAdmin
        ? `Corpus \`${corpus}\` is not available locally. Run \`${PREFIX}debug corpus get ${corpus}\`.`
        : `Corpus \`${corpus}\` is not available locally. Ask a server admin to fetch it.`,
    );
  }

  const words = await buildWordsFromRawCorpus(rawPath);
  if (words.length === 0) {
    throw new CorpusError(`Corpus \`${corpus}\` has no words.`);
  }

  await saveDminiWordsCache(corpus, words);
  wordsCache.set(corpus, words);
  return words;
}

function isSimplePattern(pattern: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(pattern);
}

export function searchCorpusWords(
  words: WordWithFreq[],
  pattern: string,
  limit: number,
): CorpusSearchResult {
  const trimmed = pattern.trim();
  const simple = isSimplePattern(trimmed);
  const regex = simple ? null : new RegExp(trimmed, "i");
  const needle = trimmed.toLowerCase();

  let totalTokens = 0;
  let matchTokens = 0;
  const matches: WordWithFreq[] = [];

  for (const entry of words) {
    totalTokens += entry.frequency;

    const matched = simple
      ? entry.word.toLowerCase().includes(needle)
      : regex!.test(entry.word);

    if (!matched) continue;

    matchTokens += entry.frequency;
    matches.push(entry);
  }

  matches.sort((a, b) => b.frequency - a.frequency);

  return {
    matches: matches.slice(0, limit),
    matchTokens,
    totalTokens,
  };
}

export function formatCorpusSearchText(
  pattern: string,
  corpus: string,
  result: CorpusSearchResult,
): string {
  const percent =
    result.totalTokens > 0
      ? ((result.matchTokens / result.totalTokens) * 100).toFixed(3)
      : "0.000";

  const header = [
    `${pattern} in ${corpus}`,
    `${result.matchTokens.toLocaleString()} / ${result.totalTokens.toLocaleString()} tokens (${percent}%)`,
    "",
  ];

  if (result.matches.length === 0) {
    return [...header, "(no matches)"].join("\n");
  }

  const nameWidth = Math.max(
    ...result.matches.map((entry) => entry.word.length),
    4,
  );
  const freqWidth = Math.max(
    ...result.matches.map((entry) => String(entry.frequency).length),
    5,
  );

  const lines = result.matches.map((entry) => {
    const word = entry.word.replace(/`/g, "​`");
    return `${word.padEnd(nameWidth)} ${String(entry.frequency).padStart(freqWidth)}`;
  });

  return [...header, ...lines].join("\n");
}

export const DEFAULT_FIND_LIMIT = 10;
export const MAX_FIND_LIMIT = 50;

export function clampFindLimit(limit: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_FIND_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_FIND_LIMIT);
}
