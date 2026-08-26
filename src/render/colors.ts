export const KEY_TEXT_LUMINANCE_CUTOFF = 0.4;

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function keyLuminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = channel((value >> 16) & 255);
  const green = channel((value >> 8) & 255);
  const blue = channel(value & 255);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function keyTextColor(hex: string): string {
  return keyLuminance(hex) > KEY_TEXT_LUMINANCE_CUTOFF ? "#14181f" : "#ffffff";
}

export function keyTextStrokeColor(textColor: string): string {
  return textColor === "#ffffff"
    ? "rgba(0,0,0,0.5)"
    : "rgba(255,255,255,0.65)";
}
