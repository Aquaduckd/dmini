export const BOARD_IDS = ["ortho", "stagger", "angle", "mini"] as const;

export type BoardType = (typeof BOARD_IDS)[number];

export const DEFAULT_BOARD: BoardType = "ortho";

export function parseBoard(value: string): BoardType | null {
  const normalized = value.trim().toLowerCase();
  return BOARD_IDS.includes(normalized as BoardType)
    ? (normalized as BoardType)
    : null;
}

export function formatBoardList(): string {
  return BOARD_IDS.map((board) => `\`${board}\``).join(" | ");
}
