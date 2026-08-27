import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { defaultMana2Root, Mana2Error, runMana2 } from "./cli.js";

export interface CorpusNgrams {
  monograms: Record<string, number>;
  bigrams: Record<string, number>;
  trigrams: Record<string, number>;
  skipgrams: Record<string, number>;
}

export interface FreqSection {
  label?: string;
  groups: string[][];
  groupOnly?: boolean;
}

type BucketKey = "mono" | "bi" | "skip" | "tri";

const BUCKET_HEADERS: Record<BucketKey, string> = {
  mono: "Monograms frequencies:",
  bi: "Bigrams frequencies:",
  skip: "Skipgrams frequencies:",
  tri: "Trigrams frequencies:",
};

const BUCKET_ORDER: BucketKey[] = ["mono", "bi", "skip", "tri"];

export class FreqError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FreqError";
  }
}

async function findParsedCorpusPath(
  mana2Root: string,
  corpus: string,
): Promise<string | null> {
  const parsedDir = path.join(
    mana2Root,
    "data",
    "corpus_parsed",
    "standard_engine",
  );
  const suffix = `_${corpus}.json`.toLowerCase();

  let entries: string[];
  try {
    entries = await readdir(parsedDir);
  } catch {
    return null;
  }

  const matches = entries.filter((name) => name.toLowerCase().endsWith(suffix));
  if (matches.length === 0) return null;

  return path.join(parsedDir, matches[0]!);
}

export async function loadCorpusNgrams(
  corpus: string,
  options: { mana2Root?: string } = {},
): Promise<CorpusNgrams> {
  const mana2Root = options.mana2Root ?? process.env.MANA2_ROOT ?? defaultMana2Root();
  let parsedPath = await findParsedCorpusPath(mana2Root, corpus);

  if (!parsedPath) {
    await runMana2("freq e", { mana2Root, corpus });
    parsedPath = await findParsedCorpusPath(mana2Root, corpus);
  }

  if (!parsedPath) {
    throw new Mana2Error(`Could not load ngram data for corpus \`${corpus}\`.`);
  }

  const raw = await readFile(parsedPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<CorpusNgrams>;

  if (
    !parsed.monograms ||
    !parsed.bigrams ||
    !parsed.trigrams ||
    !parsed.skipgrams
  ) {
    throw new Mana2Error(`Parsed corpus file for \`${corpus}\` is missing ngram data.`);
  }

  return {
    monograms: parsed.monograms,
    bigrams: parsed.bigrams,
    trigrams: parsed.trigrams,
    skipgrams: parsed.skipgrams,
  };
}

export function bucketKey(ngram: string): BucketKey | "" {
  const runes = [...ngram];
  if (runes.length === 1) return "mono";
  if (runes.length === 2) return "bi";
  if (runes.length === 3) {
    if (runes[1] === "_") return "skip";
    return "tri";
  }
  return "";
}

function permutations(str: string): string[] {
  const runes = [...str];
  if (runes.length <= 1) return [str];

  const result: string[] = [];
  for (let index = 0; index < runes.length; index++) {
    const current = runes[index]!;
    const rest = runes.slice(0, index).join("") + runes.slice(index + 1).join("");
    for (const permutation of permutations(rest)) {
      result.push(current + permutation);
    }
  }
  return result;
}

export function permutationGroups(args: string[]): string[][] {
  const groups: string[][] = [];

  for (const arg of args) {
    const seen = new Set<string>();
    const group: string[] = [];
    const runes = [...arg];
    const perms =
      runes.length === 3 && runes[1] === "_"
        ? [arg, runes[2]! + "_" + runes[0]!]
        : permutations(arg);

    for (const permutation of perms) {
      if (!seen.has(permutation)) {
        seen.add(permutation);
        group.push(permutation);
      }
    }

    groups.push(group);
  }

  return groups;
}

export function exactFreqSections(ngrams: string[]): FreqSection[] {
  return [
    {
      groups: ngrams.map((ngram) => [ngram]),
    },
  ];
}

export function permsFreqSections(ngrams: string[]): FreqSection[] {
  return [
    {
      groups: permutationGroups(ngrams),
    },
  ];
}

function pairs(chars: string[]): string[] {
  const result: string[] = [];
  for (let index = 0; index < chars.length; index++) {
    for (let other = index + 1; other < chars.length; other++) {
      result.push(chars[index]! + chars[other]!);
    }
  }
  return result;
}

function skipgramPairs(chars: string[]): string[] {
  const result: string[] = [];
  for (let index = 0; index < chars.length; index++) {
    for (let other = index + 1; other < chars.length; other++) {
      result.push(`${chars[index]}_${chars[other]}`);
    }
  }
  return result;
}

export function columnFreqSections(args: string[]): FreqSection[] {
  return args.map((arg) => {
    const chars = [...arg];
    const allPairs = [...pairs(chars), ...skipgramPairs(chars)];
    return {
      label: arg,
      groups: permutationGroups(allPairs),
      groupOnly: true,
    };
  });
}

function ngramCount(ngrams: CorpusNgrams, key: BucketKey): number {
  switch (key) {
    case "mono":
      return Object.values(ngrams.monograms).reduce((sum, value) => sum + value, 0);
    case "bi":
      return Object.values(ngrams.bigrams).reduce((sum, value) => sum + value, 0);
    case "skip":
      return Object.values(ngrams.skipgrams).reduce((sum, value) => sum + value, 0);
    case "tri":
      return Object.values(ngrams.trigrams).reduce((sum, value) => sum + value, 0);
  }
}

function ngramFrequency(
  ngrams: CorpusNgrams,
  ngram: string,
): number {
  const key = bucketKey(ngram);
  if (!key) {
    throw new FreqError(
      `Ngrams must be either length 1, 2, or 3. Received ${[...ngram].length}.`,
    );
  }

  switch (key) {
    case "mono":
      return ngrams.monograms[ngram] ?? 0;
    case "bi":
      return ngrams.bigrams[ngram] ?? 0;
    case "tri":
      return ngrams.trigrams[ngram] ?? 0;
    case "skip": {
      const runes = [...ngram];
      const lookup = runes[0]! + runes[2]!;
      return ngrams.skipgrams[lookup] ?? 0;
    }
  }
}

function lookupPct(
  ngrams: CorpusNgrams,
  ngram: string,
  totals: Record<BucketKey, number | null>,
): number {
  const key = bucketKey(ngram);
  if (!key) {
    throw new FreqError(
      `Ngrams must be either length 1, 2, or 3. Received ${[...ngram].length}.`,
    );
  }

  if (totals[key] === null) {
    totals[key] = ngramCount(ngrams, key);
  }

  const total = totals[key]!;
  if (total === 0) return 0;

  return (ngramFrequency(ngrams, ngram) * 100) / total;
}

export function formatFreqText(
  corpus: string,
  ngrams: CorpusNgrams,
  sections: FreqSection[],
): string {
  const totals: Record<BucketKey, number | null> = {
    mono: null,
    bi: null,
    skip: null,
    tri: null,
  };

  const buckets = new Map<BucketKey, { sections: string[]; total: number }>();
  for (const key of BUCKET_ORDER) {
    buckets.set(key, { sections: [], total: 0 });
  }

  for (const section of sections) {
    const sectionBuckets = new Map<BucketKey, { body: string; sum: number }>();

    for (const group of section.groups) {
      const key = bucketKey(group[0]!);
      if (!key) {
        throw new FreqError(
          `Ngrams must be either length 1, 2, or 3. Received ${[...group[0]!].length}.`,
        );
      }

      if (!sectionBuckets.has(key)) {
        sectionBuckets.set(key, { body: "", sum: 0 });
      }

      const bucketSection = sectionBuckets.get(key)!;
      let groupSum = 0;
      let memberLines = "";

      for (const ngram of group) {
        const pct = lookupPct(ngrams, ngram, totals);
        groupSum += pct;
        if (!section.groupOnly) {
          memberLines += `    ${ngram}: ${pct.toFixed(4)}%\n`;
        }
      }

      bucketSection.sum += groupSum;

      if (group.length > 1) {
        const label = group.join("+");
        const indent = section.label ? "    " : "  ";
        bucketSection.body += `${indent}${label}: ${groupSum.toFixed(4)}%\n`;
        if (!section.groupOnly) {
          bucketSection.body += memberLines;
        }
      } else {
        const indent = section.label ? "    " : "  ";
        bucketSection.body += `${indent}${group[0]}: ${groupSum.toFixed(4)}%\n`;
      }
    }

    for (const [key, bucketSection] of sectionBuckets) {
      const bucket = buckets.get(key)!;
      if (section.label) {
        bucket.sections.push(
          `  ${section.label}:\n${bucketSection.body}  Total: ${bucketSection.sum.toFixed(4)}%\n`,
        );
      } else {
        bucket.sections.push(bucketSection.body);
      }
      bucket.total += bucketSection.sum;
    }
  }

  const lines: string[] = [`Corpus: ${corpus}`, ""];

  for (const key of BUCKET_ORDER) {
    const bucket = buckets.get(key)!;
    if (bucket.sections.length === 0) continue;

    lines.push(BUCKET_HEADERS[key]);
    lines.push(...bucket.sections);
    lines.push(`Total: ${bucket.total.toFixed(4)}%`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
