import type { RenderKey } from "../layout/types.js";

export type CompareKeyStatus = "same" | "finger" | "moved";

export const COMPARE_KEY_COLORS: Record<CompareKeyStatus, string> = {
  same: "#6aaa64",
  finger: "#c9b458",
  moved: "#787c7e",
};

export type OldKeyLookup = Map<
  string,
  Pick<RenderKey, "row" | "col" | "finger">
>;

export function buildOldKeyLookup(keys: RenderKey[]): OldKeyLookup {
  return new Map(
    keys.map((key) => [
      key.c,
      { row: key.row, col: key.col, finger: key.finger },
    ]),
  );
}

export function compareKeyStatus(
  key: RenderKey,
  oldKeys: OldKeyLookup,
): CompareKeyStatus {
  const old = oldKeys.get(key.c);
  if (!old) {
    return "moved";
  }

  if (old.row === key.row && old.col === key.col) {
    return "same";
  }

  if (old.finger === key.finger) {
    return "finger";
  }

  return "moved";
}

export function compareKeyColor(
  key: RenderKey,
  oldKeys: OldKeyLookup,
): string {
  return COMPARE_KEY_COLORS[compareKeyStatus(key, oldKeys)];
}
