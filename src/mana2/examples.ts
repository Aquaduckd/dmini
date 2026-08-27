import type { LayoutDoc } from "../layout/types.js";
import { runMana2ForLayout } from "./cli.js";

export interface StatExample {
  rank: number;
  ngram: string;
  value: string;
}

export interface PaginatedExamples {
  stat: string;
  layoutName: string;
  page: number;
  pageCount: number;
  limit: number;
  total: number;
  lines: string[];
}

export const DEFAULT_EXAMPLE_LIMIT = 10;
export const MAX_EXAMPLE_LIMIT = 50;

const EXAMPLE_LINE_RE = /^\s*(\d+)\.\s+(.+?):\s+([\d.]+%?)\s*$/;

const STAT_ALIASES: Record<string, string> = {
  rdr: "redirect",
  wrd: "redirectweak",
  rd: "redirect",
  rdsf: "redirectsfs",
  in2: "inroll2",
  out2: "outroll2",
  in3: "inroll3",
  out3: "outroll3",
  alt_sfs: "altsfs",
};

export const EXAMPLE_STATS = [
  "sfb",
  "sfs",
  "skb",
  "lsb",
  "vsb",
  "alt",
  "roll",
  "redirect",
  "redirectweak",
  "altsfs",
  "redirectsfs",
  "inroll2",
  "outroll2",
  "inroll3",
  "outroll3",
] as const;

const MAX_LINE_LENGTH = 42;
const ROW_INDENT = "  ";

export function resolveStatId(input: string): string {
  const normalized = input.toLowerCase();
  return STAT_ALIASES[normalized] ?? normalized;
}

export function parseMana2ExamplesOutput(raw: string): StatExample[] {
  const examples: StatExample[] = [];

  for (const line of raw.split("\n")) {
    const match = line.match(EXAMPLE_LINE_RE);
    if (!match) continue;

    examples.push({
      rank: Number(match[1]),
      ngram: match[2]!,
      value: match[3]!,
    });
  }

  return examples;
}

export async function fetchStatExamples(
  layout: LayoutDoc,
  stat: string,
  options: { corpus?: string } = {},
): Promise<StatExample[]> {
  const statId = resolveStatId(stat);
  const raw = await runMana2ForLayout(
    layout,
    `${statId} {layout} -1`,
    options,
  );
  return parseMana2ExamplesOutput(raw);
}

function formatExampleLine(
  example: StatExample,
  rankWidth: number,
  ngramWidth: number,
  valueWidth: number,
): string {
  const rank = `${example.rank}.`.padStart(rankWidth);
  const ngram = example.ngram.padEnd(ngramWidth);
  const value = example.value.padStart(valueWidth);
  return `${ROW_INDENT}${rank} ${ngram} ${value}`;
}

export function paginateExamples(
  layoutName: string,
  stat: string,
  examples: StatExample[],
  limit: number,
  page: number,
): PaginatedExamples {
  const total = examples.length;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const start = (safePage - 1) * limit;
  const pageExamples = examples.slice(start, start + limit);

  const rankWidth = Math.max(2, String(total).length + 1);
  const ngramWidth = Math.max(
    0,
    ...pageExamples.map((example) => example.ngram.length),
  );
  const valueWidth = Math.max(
    0,
    ...pageExamples.map((example) => example.value.length),
  );

  const lines = pageExamples.map((example) =>
    formatExampleLine(example, rankWidth, ngramWidth, valueWidth),
  );

  return {
    stat: resolveStatId(stat),
    layoutName,
    page: safePage,
    pageCount,
    limit,
    total,
    lines,
  };
}

export function formatExamplesText(
  result: PaginatedExamples,
  corpus?: string,
): string {
  const headerParts = [result.stat, result.layoutName];
  if (corpus) headerParts.push(corpus);
  const header = headerParts.join(" · ");
  const body =
    result.lines.length > 0
      ? result.lines.join("\n")
      : `${ROW_INDENT}(no examples)`;
  const longestLine = Math.max(header.length, ...result.lines.map((line) => line.length));

  if (longestLine > MAX_LINE_LENGTH) {
    return [header, body].join("\n");
  }

  return [header, body].join("\n");
}

export function clampExampleLimit(limit: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_EXAMPLE_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_EXAMPLE_LIMIT);
}

export function clampExamplePage(page: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.max(Math.trunc(page), 1);
}
