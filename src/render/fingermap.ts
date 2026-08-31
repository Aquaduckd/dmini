import { keyTextColor } from "./colors.js";

const FINGER_IDS = [
  "LP",
  "LR",
  "LM",
  "LI",
  "LT",
  "RT",
  "RI",
  "RM",
  "RR",
  "RP",
] as const;

type FingerId = (typeof FINGER_IDS)[number];
type FingerColors = Record<FingerId, string>;

interface FingermapPalette {
  label: string;
  colors: FingerColors;
  textColors?: Partial<FingerColors>;
}

export const FINGER_PALETTES = {
  cminibrowser: {
    label: "Cmini Browser",
    colors: {
      LP: "#a32020",
      LR: "#6a1b9a",
      LM: "#00838f",
      LI: "#558b2f",
      LT: "#4e342e",
      RT: "#4e342e",
      RI: "#00695c",
      RM: "#b84000",
      RR: "#1565c0",
      RP: "#ad1457",
    },
  },
  neon: {
    label: "Neon",
    colors: {
      LP: "#c52f5e",
      LR: "#d153b5",
      LM: "#4d88ff",
      LI: "#20de9b",
      LT: "#e6b800",
      RT: "#d97706",
      RI: "#37f16e",
      RM: "#4d88ff",
      RR: "#d153b5",
      RP: "#c52f5e",
    },
  },
  bloom: {
    label: "Bloom",
    colors: {
      LP: "#2f2a9b",
      LR: "#7f34f6",
      LM: "#bc5fae",
      LI: "#ff60a6",
      LT: "#e6b800",
      RT: "#d97706",
      RI: "#ff9fcb",
      RM: "#bc5fae",
      RR: "#7f34f6",
      RP: "#2f2a9b",
    },
  },
  grove: {
    label: "Grove",
    colors: {
      LP: "#17342b",
      LR: "#156a44",
      LM: "#9d8829",
      LI: "#684189",
      LT: "#3f2143",
      RT: "#392627",
      RI: "#4c2587",
      RM: "#9d8829",
      RR: "#156a44",
      RP: "#17342b",
    },
  },
  sunset: {
    label: "Sunset",
    colors: {
      LP: "#3d329b",
      LR: "#346bf6",
      LM: "#ff6300",
      LI: "#ffc900",
      LT: "#5a2d4b",
      RT: "#6c3131",
      RI: "#ffe66e",
      RM: "#ff6300",
      RR: "#346bf6",
      RP: "#3d329b",
    },
  },
} as const satisfies Record<string, FingermapPalette>;

export type FingermapPaletteId = keyof typeof FINGER_PALETTES;

export const DEFAULT_FINGER_PALETTE: FingermapPaletteId = "neon";

export const FINGER_PALETTE_IDS = Object.keys(FINGER_PALETTES) as FingermapPaletteId[];

export function parseFingermapPalette(value: string): FingermapPaletteId | null {
  const normalized = value.trim().toLowerCase();
  return FINGER_PALETTE_IDS.find((id) => id === normalized) ?? null;
}

export function fingerColor(
  finger: string,
  palette: FingermapPaletteId = DEFAULT_FINGER_PALETTE,
): string {
  return FINGER_PALETTES[palette].colors[finger as FingerId] ?? "#444444";
}

export function fingerTextColor(
  finger: string,
  background: string,
  palette: FingermapPaletteId = DEFAULT_FINGER_PALETTE,
): string {
  const paletteDef = FINGER_PALETTES[palette] as FingermapPalette;
  const override = paletteDef.textColors?.[finger as FingerId];
  if (override) return override;
  return keyTextColor(background);
}
