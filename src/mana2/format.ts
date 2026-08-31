import { EmbedBuilder } from "discord.js";
import { Colors, ansiCodeBlock, textCodeBlock } from "../discord/embeds.js";
import { applyLayoutEmbedUrl } from "../layout/link.js";
import { formatLikeCount } from "../layout/types.js";
import { percentileFromCutoffs } from "./percentiles.js";
import { getStatValue, type Mana2Analysis } from "./parse.js";

interface StatDefinition {
  id: string;
  label: string;
  percent?: boolean;
  decimals?: number;
}

interface StatSection {
  title: string;
  columns: number;
  lines: StatDefinition[][];
}

const STAT_SECTIONS: StatSection[] = [
  {
    title: "Finger usage",
    columns: 4,
    lines: [
      [
        { id: "finger-usage-LP", label: "LP", percent: true },
        { id: "finger-usage-LR", label: "LR", percent: true },
        { id: "finger-usage-LM", label: "LM", percent: true },
        { id: "finger-usage-LI", label: "LI", percent: true },
      ],
      [
        { id: "finger-usage-RP", label: "RP", percent: true },
        { id: "finger-usage-RR", label: "RR", percent: true },
        { id: "finger-usage-RM", label: "RM", percent: true },
        { id: "finger-usage-RI", label: "RI", percent: true },
      ],
      [
        { id: "finger-usage-LT", label: "LT", percent: true },
        { id: "finger-usage-RT", label: "RT", percent: true },
      ],
    ],
  },
  {
    title: "Bigrams",
    columns: 3,
    lines: [
      [
        { id: "sfb", label: "SFB", percent: true, decimals: 2 },
        { id: "sfs", label: "SFS", percent: true, decimals: 2 },
        { id: "skb", label: "SKB", percent: true, decimals: 2 },
      ],
      [
        { id: "lsb", label: "LSB", decimals: 2 },
        { id: "vsb", label: "VSB", decimals: 2 },
      ],
      [
        { id: "lss", label: "LSS", decimals: 2 },
        { id: "vss", label: "VSS", decimals: 2 },
      ],
    ],
  },
  {
    title: "Trigrams",
    columns: 2,
    lines: [
      [
        { id: "alt", label: "Alt", percent: true, decimals: 2 },
        { id: "roll", label: "Roll", percent: true, decimals: 2 },
      ],
      [
        { id: "inroll2", label: "In2", percent: true, decimals: 2 },
        { id: "outroll2", label: "Out2", percent: true, decimals: 2 },
      ],
      [
        { id: "inroll3", label: "In3", percent: true, decimals: 2 },
        { id: "outroll3", label: "Out3", percent: true, decimals: 2 },
      ],
      [
        { id: "altsfs", label: "Alt+SFS", percent: true, decimals: 2 },
        { id: "redirectsfs", label: "RdSF", percent: true, decimals: 2 },
      ],
      [
        { id: "redirect", label: "Rdr", percent: true, decimals: 2 },
        { id: "redirectweak", label: "WRd", percent: true, decimals: 2 },
      ],
    ],
  },
];

const THUMB_STAT_IDS = new Set(["finger-usage-LT", "finger-usage-RT"]);

function isThumbStatsLine(line: StatDefinition[]): boolean {
  return line.length > 0 && line.every((stat) => THUMB_STAT_IDS.has(stat.id));
}

function thumbStatsInUse(analysis: Mana2Analysis): boolean {
  for (const statId of THUMB_STAT_IDS) {
    const value = getStatValue(analysis, statId);
    if (value !== undefined && value > 0) return true;
  }
  return false;
}

function sectionsForAnalysis(analysis: Mana2Analysis): StatSection[] {
  if (thumbStatsInUse(analysis)) return STAT_SECTIONS;

  return STAT_SECTIONS.map((section) => {
    if (section.title !== "Finger usage") return section;
    return {
      ...section,
      lines: section.lines.filter((line) => !isThumbStatsLine(line)),
    };
  });
}

const MAX_LINE_LENGTH = 42;
const ROW_INDENT = "  ";
const COLUMN_GAP = " ";

function colWidthFor(columns: number): number {
  return Math.floor(
    (MAX_LINE_LENGTH - ROW_INDENT.length - COLUMN_GAP.length * (columns - 1)) /
      columns,
  );
}

function formatStatValue(stat: StatDefinition, value: number): string {
  if (stat.percent) {
    if (value >= 99.95) {
      return `${Math.round(value)}%`;
    }
    return `${value.toFixed(stat.decimals ?? 1)}%`;
  }
  return value.toFixed(stat.decimals ?? 2);
}

function formatStatCellAligned(
  stat: StatDefinition,
  analysis: Mana2Analysis,
  labelWidth: number,
  valueWidth: number,
  colWidth: number,
  cutoffs?: Record<string, number[]>,
): string | null {
  const raw = getStatValue(analysis, stat.id);
  if (raw === undefined) return null;

  const plainValue = formatStatValue(stat, raw).padStart(valueWidth);
  const visibleCell = `${stat.label.padEnd(labelWidth)} ${plainValue}`;
  const pad = " ".repeat(Math.max(0, colWidth - visibleCell.length));

  let displayValue = plainValue;
  const statCutoffs = cutoffs?.[stat.id];
  if (statCutoffs) {
    const bucket = percentileFromCutoffs(statCutoffs, raw);
    if (bucket !== null) {
      displayValue = colorizePercentileText(plainValue, stat.id, bucket);
    }
  }

  return `${stat.label.padEnd(labelWidth)} ${displayValue}${pad}`;
}

function labelWidthsForSection(section: StatSection): number[] {
  return Array.from({ length: section.columns }, (_, colIndex) =>
    Math.max(
      0,
      ...section.lines.map((line) => line[colIndex]?.label.length ?? 0),
    ),
  );
}

function valueWidthsForSection(
  section: StatSection,
  analysis: Mana2Analysis,
): number[] {
  return Array.from({ length: section.columns }, (_, colIndex) =>
    Math.max(
      0,
      ...section.lines.flatMap((line) => {
        const stat = line[colIndex];
        if (!stat) return [];
        const raw = getStatValue(analysis, stat.id);
        if (raw === undefined) return [];
        return formatStatValue(stat, raw).length;
      }),
    ),
  );
}

function formatSectionRows(
  section: StatSection,
  analysis: Mana2Analysis,
  cutoffs?: Record<string, number[]>,
): string[] {
  const colWidth = colWidthFor(section.columns);
  const labelWidths = labelWidthsForSection(section);
  const valueWidths = valueWidthsForSection(section, analysis);
  const rows: string[] = [];

  for (const line of section.lines) {
    const cells = Array.from({ length: section.columns }, (_, cellIndex) => {
      const stat = line[cellIndex];
      return stat
        ? formatStatCellAligned(
            stat,
            analysis,
            labelWidths[cellIndex]!,
            valueWidths[cellIndex]!,
            colWidth,
            cutoffs,
          )
        : null;
    });

    if (cells.every((cell) => cell === null)) continue;

    while (cells.length > 0 && cells[cells.length - 1] === null) {
      cells.pop();
    }

    rows.push(
      `${ROW_INDENT}${cells
        .map((cell) => cell ?? "".padEnd(colWidth))
        .join(COLUMN_GAP)
        .trimEnd()}`,
    );
  }

  return rows;
}

const LOWER_IS_BETTER_STATS = new Set([
  "sfb",
  "sfs",
  "skb",
  "lsb",
  "vsb",
  "lss",
  "vss",
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

// Discord ansi blocks only support classic foreground codes 30–37.
const ANSI_CYAN = "\u001b[36m";
const ANSI_BLUE = "\u001b[34m";
const ANSI_YELLOW = "\u001b[33m";
const ANSI_RED = "\u001b[31m";
const ANSI_RESET = "\u001b[0m";

type PercentileTier = "top25" | "top50" | "bottom50" | "bottom25";

function percentileTier(statId: string, bucket: number): PercentileTier | null {
  if (LOWER_IS_BETTER_STATS.has(statId) || statId.startsWith("finger-usage-")) {
    if (bucket <= 24) return "top25";
    if (bucket <= 49) return "top50";
    if (bucket <= 74) return "bottom50";
    return "bottom25";
  }
  if (HIGHER_IS_BETTER_STATS.has(statId)) {
    if (bucket >= 75) return "top25";
    if (bucket >= 50) return "top50";
    if (bucket >= 25) return "bottom50";
    return "bottom25";
  }
  return null;
}

const TIER_COLORS: Record<PercentileTier, string> = {
  top25: ANSI_CYAN,
  top50: ANSI_BLUE,
  bottom50: ANSI_YELLOW,
  bottom25: ANSI_RED,
};

function colorizePercentileText(
  plainText: string,
  statId: string,
  bucket: number,
): string {
  const tier = percentileTier(statId, bucket);
  if (tier === null) return plainText;

  return `${TIER_COLORS[tier]}${plainText}${ANSI_RESET}`;
}

function formatPercentileCellAligned(
  stat: StatDefinition,
  analysis: Mana2Analysis,
  cutoffs: Record<string, number[]>,
  labelWidth: number,
  valueWidth: number,
  colWidth: number,
): string | null {
  const raw = getStatValue(analysis, stat.id);
  if (raw === undefined) return null;

  const statCutoffs = cutoffs[stat.id];
  if (!statCutoffs) return null;

  const bucket = percentileFromCutoffs(statCutoffs, raw);
  if (bucket === null) return null;

  const plainValue = String(bucket).padStart(valueWidth);
  const visibleCell = `${stat.label.padEnd(labelWidth)} ${plainValue}`;
  const pad = " ".repeat(Math.max(0, colWidth - visibleCell.length));
  const coloredValue = colorizePercentileText(plainValue, stat.id, bucket);

  return `${stat.label.padEnd(labelWidth)} ${coloredValue}${pad}`;
}

function percentileValueWidthsForSection(
  section: StatSection,
  analysis: Mana2Analysis,
  cutoffs: Record<string, number[]>,
): number[] {
  return Array.from({ length: section.columns }, (_, colIndex) =>
    Math.max(
      0,
      ...section.lines.flatMap((line) => {
        const stat = line[colIndex];
        if (!stat) return [];
        const raw = getStatValue(analysis, stat.id);
        if (raw === undefined) return [];
        const statCutoffs = cutoffs[stat.id];
        if (!statCutoffs) return [];
        const bucket = percentileFromCutoffs(statCutoffs, raw);
        if (bucket === null) return [];
        return String(bucket).length;
      }),
    ),
  );
}

function formatPercentileSectionRows(
  section: StatSection,
  analysis: Mana2Analysis,
  cutoffs: Record<string, number[]>,
): string[] {
  const colWidth = colWidthFor(section.columns);
  const labelWidths = labelWidthsForSection(section);
  const valueWidths = percentileValueWidthsForSection(section, analysis, cutoffs);
  const rows: string[] = [];

  for (const line of section.lines) {
    const cells = Array.from({ length: section.columns }, (_, cellIndex) => {
      const stat = line[cellIndex];
      return stat
        ? formatPercentileCellAligned(
            stat,
            analysis,
            cutoffs,
            labelWidths[cellIndex]!,
            valueWidths[cellIndex]!,
            colWidth,
          )
        : null;
    });

    if (cells.every((cell) => cell === null)) continue;

    while (cells.length > 0 && cells[cells.length - 1] === null) {
      cells.pop();
    }

    rows.push(
      `${ROW_INDENT}${cells
        .map((cell) => cell ?? "".padEnd(colWidth))
        .join(COLUMN_GAP)
        .trimEnd()}`,
    );
  }

  return rows;
}

export function formatPercentileText(
  analysis: Mana2Analysis,
  cutoffs: Record<string, number[]>,
): string {
  const sections: string[] = [];

  for (const section of sectionsForAnalysis(analysis)) {
    const rows = formatPercentileSectionRows(section, analysis, cutoffs);

    if (rows.length === 0) continue;

    sections.push(section.title, ...rows, "");
  }

  return sections.join("\n").trimEnd();
}

export function buildPercentilesEmbed(
  layoutName: string,
  analysis: Mana2Analysis,
  cutoffs: Record<string, number[]>,
  imageFilename: string,
  corpus = "monkeyracer",
  author?: string,
  likeCount?: number,
  layoutCount?: number,
  link?: string,
): EmbedBuilder {
  const footerParts: string[] = [];
  if (likeCount !== undefined) {
    footerParts.push(formatLikeCount(likeCount));
  }
  if (layoutCount !== undefined) {
    footerParts.push(`${layoutCount} layouts`);
  }
  footerParts.push(`Corpus: ${corpus} · percentiles`);

  const embed = new EmbedBuilder()
    .setColor(Colors.primary)
    .setTitle(layoutName)
    .setDescription(ansiCodeBlock(formatPercentileText(analysis, cutoffs)))
    .setImage(`attachment://${imageFilename}`)
    .setFooter({ text: footerParts.join(" · ") });

  if (author) {
    embed.setAuthor({ name: author });
  }

  applyLayoutEmbedUrl(embed, link);

  return embed;
}

export function formatAnalysisText(
  analysis: Mana2Analysis,
  cutoffs?: Record<string, number[]>,
): string {
  const sections: string[] = [];

  for (const section of sectionsForAnalysis(analysis)) {
    const rows = formatSectionRows(section, analysis, cutoffs);

    if (rows.length === 0) continue;

    sections.push(section.title, ...rows, "");
  }

  return sections.join("\n").trimEnd();
}

export function buildAnalysisEmbed(
  layoutName: string,
  analysis: Mana2Analysis,
  imageFilename: string,
  corpus = "monkeyracer",
  author?: string,
  cutoffs?: Record<string, number[]>,
): EmbedBuilder {
  const text = formatAnalysisText(analysis, cutoffs);
  const description = cutoffs ? ansiCodeBlock(text) : textCodeBlock(text);

  const embed = new EmbedBuilder()
    .setColor(Colors.primary)
    .setTitle(layoutName)
    .setDescription(description)
    .setImage(`attachment://${imageFilename}`)
    .setFooter({ text: `Corpus: ${corpus} · mana2` });

  if (author) {
    embed.setAuthor({ name: author });
  }

  return embed;
}

const DELTA_NEUTRAL_EPSILON_PERCENT = 0.005;
const DELTA_NEUTRAL_EPSILON_RAW = 0.01;

type DeltaSentiment = "good" | "bad" | "neutral";

function getStatDelta(
  oldAnalysis: Mana2Analysis,
  newAnalysis: Mana2Analysis,
  statId: string,
): number | undefined {
  const oldValue = getStatValue(oldAnalysis, statId);
  const newValue = getStatValue(newAnalysis, statId);
  if (oldValue === undefined || newValue === undefined) return undefined;
  return newValue - oldValue;
}

function formatDeltaValue(stat: StatDefinition, delta: number): string {
  const sign = delta > 0 ? "+" : "";
  if (stat.percent) {
    if (Math.abs(delta) >= 99.95) {
      return `${sign}${Math.round(delta)}%`;
    }
    return `${sign}${delta.toFixed(stat.decimals ?? 1)}%`;
  }
  return `${sign}${delta.toFixed(stat.decimals ?? 2)}`;
}

function deltaSentiment(statId: string, stat: StatDefinition, delta: number): DeltaSentiment {
  const neutralEpsilon = stat.percent
    ? DELTA_NEUTRAL_EPSILON_PERCENT
    : DELTA_NEUTRAL_EPSILON_RAW;
  if (Math.abs(delta) < neutralEpsilon) {
    return "neutral";
  }

  if (LOWER_IS_BETTER_STATS.has(statId) || statId.startsWith("finger-usage-")) {
    return delta < 0 ? "good" : "bad";
  }

  if (HIGHER_IS_BETTER_STATS.has(statId)) {
    return delta > 0 ? "good" : "bad";
  }

  return "neutral";
}

const DELTA_COLORS: Record<Exclude<DeltaSentiment, "neutral">, string> = {
  good: ANSI_CYAN,
  bad: ANSI_RED,
};

function colorizeDeltaText(
  plainText: string,
  statId: string,
  stat: StatDefinition,
  delta: number,
): string {
  const sentiment = deltaSentiment(statId, stat, delta);
  if (sentiment === "neutral") return plainText;
  return `${DELTA_COLORS[sentiment]}${plainText}${ANSI_RESET}`;
}

function compareValueWidthsForSection(
  section: StatSection,
  oldAnalysis: Mana2Analysis,
  newAnalysis: Mana2Analysis,
): number[] {
  return Array.from({ length: section.columns }, (_, colIndex) =>
    Math.max(
      0,
      ...section.lines.flatMap((line) => {
        const stat = line[colIndex];
        if (!stat) return [];
        const delta = getStatDelta(oldAnalysis, newAnalysis, stat.id);
        if (delta === undefined) return [];
        return formatDeltaValue(stat, delta).length;
      }),
    ),
  );
}

function formatCompareCellAligned(
  stat: StatDefinition,
  oldAnalysis: Mana2Analysis,
  newAnalysis: Mana2Analysis,
  labelWidth: number,
  valueWidth: number,
  colWidth: number,
): string | null {
  const delta = getStatDelta(oldAnalysis, newAnalysis, stat.id);
  if (delta === undefined) return null;

  const plainValue = formatDeltaValue(stat, delta).padStart(valueWidth);
  const visibleCell = `${stat.label.padEnd(labelWidth)} ${plainValue}`;
  const pad = " ".repeat(Math.max(0, colWidth - visibleCell.length));
  const coloredValue = colorizeDeltaText(plainValue, stat.id, stat, delta);

  return `${stat.label.padEnd(labelWidth)} ${coloredValue}${pad}`;
}

function formatCompareSectionRows(
  section: StatSection,
  oldAnalysis: Mana2Analysis,
  newAnalysis: Mana2Analysis,
): string[] {
  const colWidth = colWidthFor(section.columns);
  const labelWidths = labelWidthsForSection(section);
  const valueWidths = compareValueWidthsForSection(section, oldAnalysis, newAnalysis);
  const rows: string[] = [];

  for (const line of section.lines) {
    const cells = Array.from({ length: section.columns }, (_, cellIndex) => {
      const stat = line[cellIndex];
      return stat
        ? formatCompareCellAligned(
            stat,
            oldAnalysis,
            newAnalysis,
            labelWidths[cellIndex]!,
            valueWidths[cellIndex]!,
            colWidth,
          )
        : null;
    });

    if (cells.every((cell) => cell === null)) continue;

    while (cells.length > 0 && cells[cells.length - 1] === null) {
      cells.pop();
    }

    rows.push(
      `${ROW_INDENT}${cells
        .map((cell) => cell ?? "".padEnd(colWidth))
        .join(COLUMN_GAP)
        .trimEnd()}`,
    );
  }

  return rows;
}

export function formatCompareText(
  oldAnalysis: Mana2Analysis,
  newAnalysis: Mana2Analysis,
): string {
  const sections: string[] = [];

  for (const section of sectionsForAnalysis(newAnalysis)) {
    const rows = formatCompareSectionRows(section, oldAnalysis, newAnalysis);
    if (rows.length === 0) continue;
    sections.push(section.title, ...rows, "");
  }

  return sections.join("\n").trimEnd();
}

export function buildCompareEmbed(
  oldLayoutName: string,
  newLayoutName: string,
  oldAnalysis: Mana2Analysis,
  newAnalysis: Mana2Analysis,
  imageFilename: string,
  corpus = "monkeyracer",
  author?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(Colors.primary)
    .setTitle(`${newLayoutName} (new) vs ${oldLayoutName} (old)`)
    .setDescription(ansiCodeBlock(formatCompareText(oldAnalysis, newAnalysis)))
    .setImage(`attachment://${imageFilename}`)
    .setFooter({ text: `Corpus: ${corpus} · mana2` });

  if (author) {
    embed.setAuthor({ name: author });
  }

  return embed;
}
