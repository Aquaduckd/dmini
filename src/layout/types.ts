export interface LayoutPosition {
  row: number;
  col: number;
  finger: string;
}

export interface LayoutMagicRule {
  inputs: string;
  output: string;
  type?: string;
}

export interface LayoutDoc {
  name: string;
  board: string;
  keys: Record<string, LayoutPosition>;
  user?: string | number;
  likes?: Array<string | number>;
  link?: string;
  created_at?: string;
  modified_at?: string;
  magic?: LayoutMagicRule[];
}

export function layoutLikeCount(layout: LayoutDoc): number {
  return layout.likes?.length ?? 0;
}

export function formatLikeCount(count: number): string {
  return count === 1 ? "1 like" : `${count} likes`;
}

export function formatLayoutCreatedAt(createdAt?: string): string | undefined {
  if (!createdAt?.trim()) return undefined;

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return undefined;

  return `Created ${date.toISOString().slice(0, 10)}`;
}

export interface RenderKey {
  c: string;
  row: number;
  col: number;
  finger: string;
}

export function layoutToRenderKeys(layout: LayoutDoc): RenderKey[] {
  return Object.entries(layout.keys).map(([character, position]) => ({
    c: character,
    row: position.row,
    col: position.col,
    finger: position.finger,
  }));
}

export function isStaggeredBoard(board: string): boolean {
  return board !== "ortho";
}

export const REQUIRED_ANALYSIS_CHARACTERS = [
  ..."abcdefghijklmnopqrstuvwxyz",
  ",",
  ".",
  "'",
] as const;

export function missingAnalysisCharacters(
  layout: Pick<LayoutDoc, "keys">,
): string[] {
  return REQUIRED_ANALYSIS_CHARACTERS.filter(
    (character) => !(character in layout.keys),
  );
}

export function isAnalyzableLayout(layout: Pick<LayoutDoc, "keys">): boolean {
  return missingAnalysisCharacters(layout).length === 0;
}

export function layoutOwnedByUser(
  layout: Pick<LayoutDoc, "user">,
  userId: string,
): boolean {
  if (layout.user === undefined || layout.user === null || layout.user === "") {
    return false;
  }
  return String(layout.user) === String(userId);
}

export function layoutNotAnalyzableMessage(
  name: string,
  missing: string[],
): string {
  const chars = missing.map((character) => `\`${character}\``).join(", ");
  return `Layout \`${name}\` cannot be analyzed: missing ${chars}.`;
}
