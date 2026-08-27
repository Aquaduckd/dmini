import { fetchLayoutDoc, listAllLayouts } from "../api/layouts.js";
import { layoutHasMagicRules, layoutHasThumbKeys } from "../mana2/convert.js";
import { layoutToRenderKeys, type LayoutDoc } from "./types.js";

export type LayoutPoolFilter = "all" | "magic" | "thumb" | "regular";

export class NoMatchingLayoutsError extends Error {
  constructor(public readonly filter: LayoutPoolFilter) {
    const label =
      filter === "all"
        ? "layouts"
        : filter === "magic"
          ? "magic layouts"
          : filter === "thumb"
            ? "thumb layouts"
            : "regular layouts";
    super(`No ${label} found.`);
    this.name = "NoMatchingLayoutsError";
  }
}

function matchesLayoutDocFilter(
  layout: LayoutDoc,
  filter: LayoutPoolFilter,
): boolean {
  const hasMagic = layoutHasMagicRules(layout);
  const hasThumbs = layoutHasThumbKeys(layout);

  switch (filter) {
    case "magic":
      return hasMagic;
    case "thumb":
      return hasThumbs;
    case "regular":
      return !hasMagic && !hasThumbs;
    default:
      return true;
  }
}

function shuffleIndices(length: number): number[] {
  const indices = Array.from({ length }, (_, index) => index);
  for (let index = indices.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [indices[index], indices[swap]] = [indices[swap]!, indices[index]!];
  }
  return indices;
}

export async function pickRandomLayout(
  filter: LayoutPoolFilter = "all",
): Promise<LayoutDoc> {
  const summaries = (await listAllLayouts()).filter(
    (layout) => (layout.key_count ?? 0) > 0,
  );

  if (summaries.length === 0) {
    throw new NoMatchingLayoutsError(filter);
  }

  if (filter === "all") {
    const summary = summaries[Math.floor(Math.random() * summaries.length)]!;
    const layout = await fetchLayoutDoc(summary.name);
    if (layoutToRenderKeys(layout).length === 0) {
      throw new NoMatchingLayoutsError(filter);
    }
    return layout;
  }

  const maxAttempts = Math.min(50, summaries.length);
  const indices = shuffleIndices(summaries.length);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const summary = summaries[indices[attempt]!]!;
    const layout = await fetchLayoutDoc(summary.name);
    if (layoutToRenderKeys(layout).length === 0) continue;
    if (matchesLayoutDocFilter(layout, filter)) {
      return layout;
    }
  }

  throw new NoMatchingLayoutsError(filter);
}
