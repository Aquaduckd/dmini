import type { LayoutCombo, LayoutDoc } from "./types.js";

const COMBO_RULE_COLUMNS = 3;
const COMBO_RULE_COLUMN_GAP = 2;
const BASE_LAYER_LABEL = "base";

export class ComboParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComboParseError";
  }
}

function comboLayerKey(layer?: string): string {
  const trimmed = layer?.trim();
  return trimmed ? trimmed : BASE_LAYER_LABEL;
}

function comboIdentity(combo: LayoutCombo): string {
  return `${comboLayerKey(combo.layer)}\0${combo.inputs}`;
}

export function parseCombos(
  text: string,
  layout?: Pick<LayoutDoc, "keys">,
): LayoutCombo[] {
  const combos: LayoutCombo[] = [];
  const seen = new Set<string>();

  for (const [index, rawLine] of text.split("\n").entries()) {
    const line = rawLine.trim();
    const lineno = index + 1;

    if (!line || line.startsWith("#")) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 2) {
      throw new ComboParseError(
        `Line ${lineno}: expected \`inputs output [layer]\`.`,
      );
    }
    if (parts.length > 3) {
      throw new ComboParseError(`Line ${lineno}: too many fields.`);
    }

    const inputs = parts[0]!;
    const output = parts[1]!;
    const layer = parts[2];

    if (!inputs || !output) {
      throw new ComboParseError(
        `Line ${lineno}: inputs and output are required.`,
      );
    }

    if (layout) {
      for (const character of inputs) {
        if (!(character in layout.keys)) {
          throw new ComboParseError(
            `Line ${lineno}: input key \`${character}\` is not on the layout.`,
          );
        }
      }
    }

    const combo: LayoutCombo = { inputs, output };
    if (layer) combo.layer = layer;

    const identity = comboIdentity(combo);
    if (seen.has(identity)) {
      throw new ComboParseError(
        `Line ${lineno}: duplicate combo \`${inputs}\`${layer ? ` on layer \`${layer}\`` : ""}.`,
      );
    }

    seen.add(identity);
    combos.push(combo);
  }

  return combos;
}

export function mergeCombos(
  existing: LayoutCombo[],
  incoming: LayoutCombo[],
): LayoutCombo[] {
  const index = new Map(existing.map((combo, i) => [comboIdentity(combo), i]));
  const merged = [...existing];

  for (const combo of incoming) {
    const identity = comboIdentity(combo);
    const existingIndex = index.get(identity);
    if (existingIndex !== undefined) {
      merged[existingIndex] = combo;
    } else {
      index.set(identity, merged.length);
      merged.push(combo);
    }
  }

  return merged;
}

export function formatComboRuleLine(combo: LayoutCombo): string {
  return `${combo.inputs} → ${combo.output}`;
}

function formatComboRuleLineWithLayer(combo: LayoutCombo): string {
  const layerSuffix = combo.layer?.trim()
    ? ` [${combo.layer.trim()}]`
    : "";
  return `${formatComboRuleLine(combo)}${layerSuffix}`;
}

function groupCombosByLayer(
  combos: LayoutCombo[],
): Array<{ layer: string; combos: LayoutCombo[] }> {
  const groups = new Map<string, LayoutCombo[]>();
  const layerOrder: string[] = [];

  for (const combo of combos) {
    const layer = comboLayerKey(combo.layer);
    if (!groups.has(layer)) {
      groups.set(layer, []);
      layerOrder.push(layer);
    }
    groups.get(layer)!.push(combo);
  }

  return layerOrder.map((layer) => ({
    layer,
    combos: groups.get(layer)!,
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

function formatComboColumns(
  combos: LayoutCombo[],
  includeLayerSuffix = false,
): string[] {
  const cells = combos.map((combo) =>
    includeLayerSuffix ? formatComboRuleLineWithLayer(combo) : formatComboRuleLine(combo),
  );
  const colWidths = columnWidthsForCells(cells, COMBO_RULE_COLUMNS);
  const lines: string[] = [];

  for (
    let rowStart = 0;
    rowStart < cells.length;
    rowStart += COMBO_RULE_COLUMNS
  ) {
    const rowCells = cells.slice(rowStart, rowStart + COMBO_RULE_COLUMNS);
    const parts = rowCells.map((cell, columnIndex) =>
      cell.padEnd(colWidths[columnIndex]!),
    );
    lines.push(`  ${parts.join(" ".repeat(COMBO_RULE_COLUMN_GAP))}`);
  }

  return lines;
}

export function formatComboCount(count: number): string {
  return count === 1 ? "1 combo" : `${count} combos`;
}

export function formatCombosText(combos: LayoutCombo[]): string {
  if (combos.length === 0) return "";

  const groups = groupCombosByLayer(combos);
  if (groups.length === 1 && groups[0]!.layer === BASE_LAYER_LABEL) {
    return formatComboColumns(groups[0]!.combos).join("\n");
  }

  return groups
    .map(({ layer, combos: groupedCombos }) => {
      const lines = formatComboColumns(groupedCombos);
      return [layer, ...lines].join("\n");
    })
    .join("\n\n");
}

export function layoutHasComboRules(
  layout: Pick<LayoutDoc, "combos">,
): boolean {
  return (layout.combos?.length ?? 0) > 0;
}
