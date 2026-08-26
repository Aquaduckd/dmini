import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { defaultMana2Root, Mana2Error, runMana2 } from "./cli.js";

interface ParsedCorpusFile {
  monograms: Record<string, number>;
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

export async function loadCorpusMonograms(
  corpus: string,
  options: { mana2Root?: string } = {},
): Promise<Record<string, number>> {
  const mana2Root = options.mana2Root ?? process.env.MANA2_ROOT ?? defaultMana2Root();
  let parsedPath = await findParsedCorpusPath(mana2Root, corpus);

  if (!parsedPath) {
    await runMana2("freq e", { mana2Root, corpus });
    parsedPath = await findParsedCorpusPath(mana2Root, corpus);
  }

  if (!parsedPath) {
    throw new Mana2Error(`Could not load monogram data for corpus \`${corpus}\`.`);
  }

  const raw = await readFile(parsedPath, "utf8");
  const parsed = JSON.parse(raw) as ParsedCorpusFile;

  if (!parsed.monograms || typeof parsed.monograms !== "object") {
    throw new Mana2Error(`Parsed corpus file for \`${corpus}\` has no monograms.`);
  }

  return parsed.monograms;
}
