import type { LayoutMagicRule } from "./types.js";

const DEFAULT_MAGIC_RULE_TYPE = "other";
const MAGIC_RULE_COLUMNS = 4;
const MAGIC_RULE_COLUMN_GAP = 2;

export const MAGIC_RULE_TYPES = [
  "repeat",
  "magic",
  "adaptive",
  "chiral",
] as const;

export type MagicRuleType = (typeof MAGIC_RULE_TYPES)[number];

export class MagicParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MagicParseError";
  }
}

export function parseMagicRules(text: string): LayoutMagicRule[] {
  const rules: LayoutMagicRule[] = [];
  const seenInputs = new Set<string>();

  for (const [index, rawLine] of text.split("\n").entries()) {
    const line = rawLine.trim();
    const lineno = index + 1;

    if (!line || line.startsWith("#")) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 2) {
      throw new MagicParseError(
        `Line ${lineno}: expected \`inputs output [type]\`.`,
      );
    }
    if (parts.length > 3) {
      throw new MagicParseError(`Line ${lineno}: too many fields.`);
    }

    const inputs = parts[0]!;
    const output = parts[1]!;
    const ruleType = parts[2];

    if (!inputs || !output) {
      throw new MagicParseError(
        `Line ${lineno}: inputs and output are required.`,
      );
    }

    if (
      ruleType &&
      !MAGIC_RULE_TYPES.includes(ruleType as MagicRuleType)
    ) {
      throw new MagicParseError(`Line ${lineno}: unknown type \`${ruleType}\`.`);
    }

    if (seenInputs.has(inputs)) {
      throw new MagicParseError(
        `Line ${lineno}: duplicate inputs \`${inputs}\`.`,
      );
    }

    seenInputs.add(inputs);
    const rule: LayoutMagicRule = { inputs, output };
    if (ruleType) rule.type = ruleType;
    rules.push(rule);
  }

  return rules;
}

export function mergeMagicRules(
  existing: LayoutMagicRule[],
  incoming: LayoutMagicRule[],
): LayoutMagicRule[] {
  const index = new Map(existing.map((rule, i) => [rule.inputs, i]));
  const merged = [...existing];

  for (const rule of incoming) {
    const existingIndex = index.get(rule.inputs);
    if (existingIndex !== undefined) {
      merged[existingIndex] = rule;
    } else {
      index.set(rule.inputs, merged.length);
      merged.push(rule);
    }
  }

  return merged;
}

export function magicRuleType(rule: LayoutMagicRule): string {
  return rule.type?.trim() || DEFAULT_MAGIC_RULE_TYPE;
}

export function formatMagicRuleLine(rule: LayoutMagicRule): string {
  return `${rule.inputs} → ${rule.output}`;
}

function groupMagicRulesByType(
  rules: LayoutMagicRule[],
): Array<{ type: string; rules: LayoutMagicRule[] }> {
  const groups = new Map<string, LayoutMagicRule[]>();
  const typeOrder: string[] = [];

  for (const rule of rules) {
    const type = magicRuleType(rule);
    if (!groups.has(type)) {
      groups.set(type, []);
      typeOrder.push(type);
    }
    groups.get(type)!.push(rule);
  }

  return typeOrder.map((type) => ({
    type,
    rules: groups.get(type)!,
  }));
}

function columnWidthsForCells(cells: string[], columns: number): number[] {
  return Array.from({ length: columns }, (_, columnIndex) => {
    let max = 0;
    for (let index = columnIndex; index < cells.length; index += columns) {
      max = Math.max(max, cells[index]!.length);
    }
    return max;
  });
}

function formatMagicRulesColumns(rules: LayoutMagicRule[]): string[] {
  const cells = rules.map(formatMagicRuleLine);
  const colWidths = columnWidthsForCells(cells, MAGIC_RULE_COLUMNS);
  const lines: string[] = [];

  for (
    let rowStart = 0;
    rowStart < cells.length;
    rowStart += MAGIC_RULE_COLUMNS
  ) {
    const rowCells = cells.slice(rowStart, rowStart + MAGIC_RULE_COLUMNS);
    const parts = rowCells.map((cell, columnIndex) =>
      cell.padEnd(colWidths[columnIndex]!),
    );
    lines.push(`  ${parts.join(" ".repeat(MAGIC_RULE_COLUMN_GAP))}`);
  }

  return lines;
}

export function formatMagicRuleCount(count: number): string {
  return count === 1 ? "1 magic rule" : `${count} magic rules`;
}

export function formatMagicRulesText(rules: LayoutMagicRule[]): string {
  if (rules.length === 0) return "";

  return groupMagicRulesByType(rules)
    .map(({ type, rules: groupedRules }) => {
      const lines = formatMagicRulesColumns(groupedRules);
      return [type, ...lines].join("\n");
    })
    .join("\n\n");
}
