import { fetchLayoutDoc, listAllLayouts, type LayoutSummary } from "../api/layouts.js";
import type { LayoutDoc } from "./types.js";

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

function matchesSummaryFilter(
  summary: LayoutSummary,
  filter: LayoutPoolFilter,
): boolean {
  const hasMagic = summary.has_magic === true;
  const hasThumbs = summary.has_thumbs === true;

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

export async function pickRandomLayout(
  filter: LayoutPoolFilter = "all",
): Promise<LayoutDoc> {
  let summaries = (await listAllLayouts()).filter(
    (layout) => (layout.key_count ?? 0) > 0,
  );

  if (filter !== "all") {
    summaries = summaries.filter((summary) =>
      matchesSummaryFilter(summary, filter),
    );
  }

  if (summaries.length === 0) {
    throw new NoMatchingLayoutsError(filter);
  }

  const summary = summaries[Math.floor(Math.random() * summaries.length)]!;
  return fetchLayoutDoc(summary.name);
}
