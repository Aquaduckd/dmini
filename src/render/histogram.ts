import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { BACKGROUND_COLOR, KEY_LABEL_FONT_FAMILY } from "./constants.js";
import {
  valueToPercentile,
  type DistributionRenderOptions,
} from "./distribution.js";

const WIDTH = 720;
const HEIGHT = 360;
const PADDING = { top: 36, right: 28, bottom: 52, left: 56 };
const SAMPLE_COUNT = 160;

const CURVE_COLOR = "#5b9fd4";
const CURVE_FILL = "rgba(91, 159, 212, 0.18)";
const MARKER_COLOR = "#f0b429";
const AXIS_COLOR = "rgba(255,255,255,0.35)";
const LABEL_COLOR = "rgba(255,255,255,0.75)";
const GRID_COLOR = "rgba(255,255,255,0.08)";
const MARKER_LABEL_GAP = 8;

export type HistogramRenderOptions = DistributionRenderOptions;

function plotWidth(): number {
  return WIDTH - PADDING.left - PADDING.right;
}

function plotHeight(): number {
  return HEIGHT - PADDING.top - PADDING.bottom;
}

function silvermanBandwidth(values: number[]): number {
  const n = values.length;
  if (n < 2) return 1;

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance) || 1;
  const q1 = sorted[Math.floor((n - 1) * 0.25)] ?? sorted[0]!;
  const q3 = sorted[Math.floor((n - 1) * 0.75)] ?? sorted[n - 1]!;
  const iqr = q3 - q1;
  const scale = Math.min(std, iqr > 0 ? iqr / 1.34 : std) || std || 1;
  return 1.06 * scale * n ** -0.2;
}

function gaussianKde(values: number[], bandwidth: number): (x: number) => number {
  const factor = 1 / (bandwidth * Math.sqrt(2 * Math.PI));
  return (x: number) => {
    let sum = 0;
    for (const value of values) {
      const z = (x - value) / bandwidth;
      sum += Math.exp(-0.5 * z * z);
    }
    return (sum / values.length) * factor;
  };
}

function valueToX(
  value: number,
  valueMin: number,
  valueMax: number,
): number {
  const clamped = Math.min(valueMax, Math.max(valueMin, value));
  return (
    PADDING.left +
    ((clamped - valueMin) / (valueMax - valueMin)) * plotWidth()
  );
}

function drawLabel(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  align: "left" | "center" | "right" = "left",
): void {
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = `12px ${KEY_LABEL_FONT_FAMILY}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

export function renderHistogramPng(options: HistogramRenderOptions): Buffer {
  const {
    statLabel,
    layoutName,
    layoutValue,
    values,
    formatValue,
    rangeMin,
    rangeMax,
  } = options;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const dataMin = Math.min(...values, layoutValue);
  const dataMax = Math.max(...values, layoutValue);
  const valueMin = rangeMin ?? dataMin;
  const valueMax = rangeMax ?? dataMax;
  const plotMax = valueMax > valueMin ? valueMax : valueMin + 1;

  const kde = gaussianKde(values, silvermanBandwidth(values));
  const samples: Array<{ value: number; density: number }> = [];
  let maxDensity = 0;

  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const value = valueMin + ((plotMax - valueMin) * i) / SAMPLE_COUNT;
    const density = kde(value);
    maxDensity = Math.max(maxDensity, density);
    samples.push({ value, density });
  }

  const layoutPercentile = valueToPercentile(values, layoutValue);
  const baselineY = PADDING.top + plotHeight();
  const toY = (density: number) =>
    PADDING.top + plotHeight() - (density / maxDensity) * plotHeight();

  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  for (let tick = 0; tick <= 4; tick++) {
    const y = PADDING.top + (plotHeight() * tick) / 4;
    ctx.beginPath();
    ctx.moveTo(PADDING.left, y);
    ctx.lineTo(WIDTH - PADDING.right, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(valueToX(samples[0]!.value, valueMin, plotMax), baselineY);
  for (const point of samples) {
    ctx.lineTo(valueToX(point.value, valueMin, plotMax), toY(point.density));
  }
  ctx.lineTo(
    valueToX(samples[samples.length - 1]!.value, valueMin, plotMax),
    baselineY,
  );
  ctx.closePath();
  ctx.fillStyle = CURVE_FILL;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(
    valueToX(samples[0]!.value, valueMin, plotMax),
    toY(samples[0]!.density),
  );
  for (let i = 1; i < samples.length; i++) {
    const point = samples[i]!;
    ctx.lineTo(valueToX(point.value, valueMin, plotMax), toY(point.density));
  }
  ctx.strokeStyle = CURVE_COLOR;
  ctx.lineWidth = 2;
  ctx.stroke();

  const markerX = valueToX(layoutValue, valueMin, plotMax);
  const markerY = toY(kde(layoutValue));
  ctx.strokeStyle = MARKER_COLOR;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(markerX, PADDING.top);
  ctx.lineTo(markerX, baselineY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = MARKER_COLOR;
  ctx.beginPath();
  ctx.arc(markerX, markerY, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING.left, baselineY);
  ctx.lineTo(WIDTH - PADDING.right, baselineY);
  ctx.stroke();

  const plotCenterX = PADDING.left + plotWidth() / 2;
  const onRightHalf = markerX >= plotCenterX;

  drawLabel(ctx, formatValue(valueMin), PADDING.left, HEIGHT - 24, "left");
  drawLabel(
    ctx,
    formatValue(plotMax),
    WIDTH - PADDING.right,
    HEIGHT - 24,
    "right",
  );
  drawLabel(ctx, statLabel, WIDTH / 2, HEIGHT - 24, "center");
  drawLabel(
    ctx,
    `${statLabel} distribution · ${layoutName}`,
    PADDING.left,
    18,
    "left",
  );
  drawLabel(
    ctx,
    `${formatValue(layoutValue)} · ${Math.round(layoutPercentile)}`,
    onRightHalf ? markerX - MARKER_LABEL_GAP : markerX + MARKER_LABEL_GAP,
    PADDING.top - 14,
    onRightHalf ? "right" : "left",
  );

  return canvas.toBuffer("image/png");
}
