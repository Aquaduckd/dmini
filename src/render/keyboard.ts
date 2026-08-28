import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import type { RenderKey } from "../layout/types.js";
import {
  BACKGROUND_COLOR,
  C_ADJ,
  CANVAS_PADDING,
  KEY_BORDER_COLOR,
  KEY_LABEL_FONT_FAMILY,
  KEY_GAP,
  KEY_RADIUS,
  KEY_SIZE,
  KEY_W,
  ROW_OFFSET,
} from "./constants.js";
import { keyTextColor, keyTextStrokeColor } from "./colors.js";
import {
  buildOldKeyLookup,
  compareKeyColor,
  type OldKeyLookup,
} from "./compare.js";
import {
  DEFAULT_FINGER_PALETTE,
  fingerColor,
  fingerTextColor,
  type FingermapPaletteId,
} from "./fingermap.js";
import { keyHeatColor, type HeatContext } from "./heatmap.js";

export type KeyboardRenderMode = "fingermap" | "heatmap" | "compare";

export interface KeyboardRenderOptions {
  mode?: KeyboardRenderMode;
  heat?: HeatContext;
  fingermapPalette?: FingermapPaletteId;
  compareOldKeys?: RenderKey[];
}

interface MeasuredRow {
  visualIndex: number;
  rowNumber: number;
  items: Array<{ col: number; key: RenderKey }>;
  rowOffset: number;
}

interface KeyboardMeasurement {
  rows: MeasuredRow[];
  width: number;
  height: number;
}

function thumbDrawnCol(key: Pick<RenderKey, "finger" | "col">): number {
  const leftThumbColumn = 3;
  return (key.finger === "LT" ? leftThumbColumn : leftThumbColumn + 3) + key.col;
}

function getRowOffset(row: number, staggered: boolean): number {
  if (!staggered) return 0;
  return (ROW_OFFSET[row] ?? 0) * KEY_W;
}

function keyX(col: number, rowOffset: number): number {
  return rowOffset + col * KEY_W + (col >= 5 ? C_ADJ : 0);
}

function measureKeyboard(
  keys: RenderKey[],
  staggered: boolean,
): KeyboardMeasurement {
  const byRow = new Map<number, RenderKey[]>();

  for (const key of keys) {
    const rowKeys = byRow.get(key.row) ?? [];
    rowKeys.push(key);
    byRow.set(key.row, rowKeys);
  }

  const rowNumbers = [...byRow.keys()].sort((a, b) => a - b);
  let width = 0;

  const rows = rowNumbers.map((rowNumber, visualIndex) => {
    const rowKeys = (byRow.get(rowNumber) ?? [])
      .slice()
      .sort((a, b) => a.col - b.col);
    const isThumb = rowNumber >= 3;
    const rowOffset = isThumb
      ? getRowOffset(2, staggered)
      : getRowOffset(rowNumber, staggered);
    const colOf = isThumb ? thumbDrawnCol : (key: RenderKey) => key.col;
    const items = rowKeys.map((key) => ({ col: colOf(key), key }));

    for (const item of items) {
      width = Math.max(width, keyX(item.col, rowOffset) + KEY_SIZE);
    }

    return { visualIndex, rowNumber, items, rowOffset };
  });

  const height =
    rows.length > 0
      ? rows.length * (KEY_SIZE + KEY_GAP) - KEY_GAP
      : 0;

  return { rows, width, height };
}

function roundRectPath(
  context: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function formatKeyLabel(character: string): string {
  const label = character.length > 2 ? character.slice(0, 2) : character;
  return label.replace(/[a-z]/g, (letter) => letter.toUpperCase());
}

function keyLabelFontSize(label: string): number {
  const baseSize = label.length > 1 ? 14 : 20;
  if (/^[A-Z]+$/.test(label)) {
    return Math.round(baseSize * 0.8);
  }
  return baseSize;
}

interface DrawKeyOptions {
  mode: KeyboardRenderMode;
  heat?: HeatContext;
  fingermapPalette: FingermapPaletteId;
  compareOldKeys?: OldKeyLookup;
}

function drawKey(
  context: SKRSContext2D,
  key: RenderKey,
  x: number,
  y: number,
  options: DrawKeyOptions,
): void {
  let background: string;
  let textColor: string;

  if (options.mode === "compare" && options.compareOldKeys) {
    background = compareKeyColor(key, options.compareOldKeys);
    textColor = keyTextColor(background);
  } else if (options.mode === "heatmap" && options.heat) {
    background = keyHeatColor(options.heat, key.c);
    textColor = fingerTextColor(
      key.finger,
      background,
      options.fingermapPalette,
    );
  } else {
    background = fingerColor(key.finger, options.fingermapPalette);
    textColor = fingerTextColor(
      key.finger,
      background,
      options.fingermapPalette,
    );
  }
  const label = formatKeyLabel(key.c);
  const fontSize = keyLabelFontSize(label);

  roundRectPath(context, x, y, KEY_SIZE, KEY_SIZE, KEY_RADIUS);
  context.fillStyle = background;
  context.fill();
  context.strokeStyle = KEY_BORDER_COLOR;
  context.lineWidth = 1;
  context.stroke();

  context.font = `bold ${fontSize}px ${KEY_LABEL_FONT_FAMILY}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.strokeStyle = keyTextStrokeColor(textColor);
  context.lineWidth = 1;
  context.lineJoin = "round";
  context.strokeText(label, x + KEY_SIZE / 2, y + KEY_SIZE / 2);
  context.fillStyle = textColor;
  context.fillText(label, x + KEY_SIZE / 2, y + KEY_SIZE / 2);
}

export function renderKeyboardPng(
  keys: RenderKey[],
  staggered: boolean,
  options: KeyboardRenderOptions = {},
): Buffer {
  const mode = options.mode ?? "fingermap";
  const useHeatmap = mode === "heatmap" && options.heat !== undefined;
  const useCompare = mode === "compare" && options.compareOldKeys !== undefined;
  const renderMode: KeyboardRenderMode = useCompare
    ? "compare"
    : useHeatmap
      ? "heatmap"
      : "fingermap";
  const fingermapPalette = options.fingermapPalette ?? DEFAULT_FINGER_PALETTE;
  const compareOldKeys = useCompare
    ? buildOldKeyLookup(options.compareOldKeys!)
    : undefined;

  const measurement = measureKeyboard(keys, staggered);
  const canvas = createCanvas(
    Math.ceil(measurement.width + CANVAS_PADDING * 2),
    Math.ceil(measurement.height + CANVAS_PADDING * 2),
  );
  const context = canvas.getContext("2d");

  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (const row of measurement.rows) {
    const y = CANVAS_PADDING + row.visualIndex * (KEY_SIZE + KEY_GAP);

    for (const item of row.items) {
      const x = CANVAS_PADDING + keyX(item.col, row.rowOffset);
      drawKey(context, item.key, x, y, {
        mode: renderMode,
        heat: options.heat,
        fingermapPalette,
        compareOldKeys,
      });
    }
  }

  return canvas.toBuffer("image/png");
}
