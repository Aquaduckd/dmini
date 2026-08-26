import type { RenderKey } from "../layout/types.js";

export const HEAT_RAMPS = {
  ember: {
    label: "Ember",
    stops: ["#16181f", "#4a1414", "#8f2118", "#d0491f", "#f08c2e", "#ffcc66"],
  },
  ocean: {
    label: "Ocean",
    stops: ["#101828", "#123a5c", "#0f6f96", "#17a2b8", "#57cfc4", "#b6f0dd"],
  },
} as const;

export type HeatRampId = keyof typeof HEAT_RAMPS;

export const DEFAULT_HEAT_RAMP: HeatRampId = "ocean";

export interface HeatContext {
  monograms: Record<string, number>;
  total: number;
  maxShare: number;
}

export function corpusNonWhitespaceTotal(
  monograms: Record<string, number>,
): number {
  let total = 0;
  for (const [character, frequency] of Object.entries(monograms)) {
    if (character !== " " && character.trim() !== "") {
      total += frequency;
    }
  }
  return total;
}

export function heatShare(
  monograms: Record<string, number>,
  total: number,
  character: string,
): number {
  if (total <= 0) return 0;

  const folded = character.toLowerCase();
  const frequency =
    monograms[character] ??
    monograms[folded] ??
    monograms[character.toUpperCase()] ??
    0;

  return (frequency * 100) / total;
}

export function layoutMaxShare(
  monograms: Record<string, number>,
  total: number,
  keys: RenderKey[],
): number {
  let max = 0;
  for (const key of keys) {
    max = Math.max(max, heatShare(monograms, total, key.c));
  }
  return max;
}

export function buildHeatContext(
  monograms: Record<string, number>,
  keys: RenderKey[],
): HeatContext {
  const total = corpusNonWhitespaceTotal(monograms);
  return {
    monograms,
    total,
    maxShare: layoutMaxShare(monograms, total, keys),
  };
}

export function heatT(share: number, maxShare: number): number {
  if (share <= 0 || maxShare <= 0) return 0;
  return Math.sqrt(share / maxShare);
}

function mixChannel(a: number, b: number, factor: number, shift: number): string {
  const av = (a >> shift) & 255;
  const bv = (b >> shift) & 255;
  return Math.round(av + (bv - av) * factor)
    .toString(16)
    .padStart(2, "0");
}

export function heatColor(
  t: number,
  ramp: HeatRampId = DEFAULT_HEAT_RAMP,
): string {
  const stops = HEAT_RAMPS[ramp].stops;
  const clamped = Math.max(0, Math.min(1, t));
  const x = clamped * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(x));
  const factor = x - index;
  const a = Number.parseInt(stops[index]!.slice(1), 16);
  const b = Number.parseInt(stops[index + 1]!.slice(1), 16);
  return `#${mixChannel(a, b, factor, 16)}${mixChannel(a, b, factor, 8)}${mixChannel(a, b, factor, 0)}`;
}

export function keyHeatColor(context: HeatContext, character: string): string {
  const share = heatShare(context.monograms, context.total, character);
  return heatColor(heatT(share, context.maxShare));
}
