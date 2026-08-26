import type { LayoutDoc } from "../layout/types.js";
import { runMana2ForLayout } from "./cli.js";
import { getLayoutStats } from "./cache.js";
import { parseMana2Analysis, type Mana2Analysis } from "./parse.js";

export { Mana2Error } from "./cli.js";

export async function analyzeLayoutUncached(
  layout: LayoutDoc,
  options: { mana2Root?: string; corpus?: string } = {},
): Promise<Mana2Analysis> {
  const raw = await analyzeLayoutRaw(layout, options);
  return parseMana2Analysis(raw);
}

export async function analyzeLayoutRaw(
  layout: LayoutDoc,
  options: { mana2Root?: string; corpus?: string } = {},
): Promise<string> {
  return runMana2ForLayout(layout, "json {layout}", options);
}

export async function analyzeLayout(
  layout: LayoutDoc,
  options: { mana2Root?: string; corpus?: string } = {},
): Promise<Mana2Analysis> {
  if (!options.corpus?.trim()) {
    return analyzeLayoutUncached(layout, options);
  }

  return getLayoutStats(layout, options.corpus, options);
}
