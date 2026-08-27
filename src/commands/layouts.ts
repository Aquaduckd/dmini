import { resolveAuthorUserId } from "../api/authors.js";
import { layoutMatchesSearch } from "../api/layoutSuggest.js";
import {
  LayoutApiError,
  listAllLayouts,
  listLayouts,
  type LayoutSummary,
} from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import {
  errorEmbed,
  fitsInCodeBlock,
  infoEmbed,
  replyEmbed,
  textCodeBlock,
} from "../discord/embeds.js";
import { formatPaginationFooter } from "../discord/pagination.js";
import { replyLoggedError } from "../discord/errors.js";
import { CorpusError } from "../mana2/corpus.js";
import { resolveCorpus } from "../config/user.js";
import {
  buildLikesAwardData,
  formatLayoutAwardBadges,
  loadCorpusAwards,
  loadLikesAwards,
  refreshLikesAwards,
  type CorpusAwards,
  type LikesAwards,
} from "../mana2/awards.js";

export const DEFAULT_LAYOUT_LIST_LIMIT = 20;
export const MAX_LAYOUT_LIST_LIMIT = 50;
export const ROW_INDENT = "  ";

export type LayoutSort = "name" | "likes" | "created" | "modified";
export type LayoutSortDirection = "asc" | "desc";

interface LayoutListScope {
  label: string;
  title: string;
  userId?: string;
}

const NAME_COLUMN_GAP = "  ";
const AWARDS_COLUMN_GAP = "  ";
const MAX_LAYOUT_NAME_LENGTH = 32;

interface LayoutListAwardContext {
  corpusAwards: CorpusAwards | null;
  likesAwards: LikesAwards | null;
}

function awardBadgesForLayout(
  layoutName: string,
  awardContext: LayoutListAwardContext,
): string {
  return formatLayoutAwardBadges(layoutName, awardContext.corpusAwards, {
    likesAwards: awardContext.likesAwards,
  });
}

const SORT_LABELS: Record<Exclude<LayoutSort, "name">, string> = {
  likes: "likes",
  created: "created",
  modified: "modified",
};

function layoutTimestamp(value?: string): number {
  if (!value?.trim()) return 0;

  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

function formatLayoutDate(value?: string): string {
  if (!value?.trim()) return "—";

  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return "—";

  return new Date(ms).toISOString().slice(0, 10);
}

export function displayLayoutName(name: string): string {
  if (name.length <= MAX_LAYOUT_NAME_LENGTH) return name;
  if (MAX_LAYOUT_NAME_LENGTH <= 1) return "…";
  return `${name.slice(0, MAX_LAYOUT_NAME_LENGTH - 1)}…`;
}

export function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_LAYOUT_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LAYOUT_LIST_LIMIT);
}

export function clampPage(page: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.max(Math.trunc(page), 1);
}

function parseLayoutSort(value?: string): LayoutSort {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "name") return "name";
  if (normalized === "likes") return "likes";
  if (normalized === "created" || normalized === "created_at") return "created";
  if (normalized === "modified" || normalized === "modified_at") return "modified";
  throw new FlagParseError(
    "Sort must be `name`, `likes`, `created`, or `modified`.",
  );
}

function filterLayoutsBySearch(
  layouts: LayoutSummary[],
  query: string,
): LayoutSummary[] {
  const trimmed = query.trim();
  if (!trimmed) return layouts;
  return layouts.filter((layout) => layoutMatchesSearch(layout.name, trimmed));
}

function defaultSortDirection(sort: LayoutSort): LayoutSortDirection {
  return sort === "name" ? "asc" : "desc";
}

function parseSortDirection(
  asc?: boolean,
  desc?: boolean,
  sort: LayoutSort = "name",
): LayoutSortDirection {
  if (asc && desc) {
    throw new FlagParseError("Use only one of --asc or --desc.");
  }
  if (asc) return "asc";
  if (desc) return "desc";
  return defaultSortDirection(sort);
}

function comparePrimary(
  a: LayoutSummary,
  b: LayoutSummary,
  sort: LayoutSort,
): number {
  if (sort === "likes") {
    return (a.like_count ?? 0) - (b.like_count ?? 0);
  }

  if (sort === "created") {
    return layoutTimestamp(a.created_at) - layoutTimestamp(b.created_at);
  }

  if (sort === "modified") {
    return layoutTimestamp(a.modified_at) - layoutTimestamp(b.modified_at);
  }

  return a.name.localeCompare(b.name);
}

function sortLayouts(
  layouts: LayoutSummary[],
  sort: LayoutSort,
  direction: LayoutSortDirection,
): LayoutSummary[] {
  return [...layouts].sort((a, b) => {
    const diff = comparePrimary(a, b, sort);
    if (diff !== 0) {
      return direction === "desc" ? -diff : diff;
    }
    return a.name.localeCompare(b.name);
  });
}

export function paginateLayouts(
  layouts: LayoutSummary[],
  limit: number,
  page: number,
): {
  items: LayoutSummary[];
  total: number;
  pageCount: number;
  safePage: number;
} {
  const total = layouts.length;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const start = (safePage - 1) * limit;

  return {
    items: layouts.slice(start, start + limit),
    total,
    pageCount,
    safePage,
  };
}

function formatLayoutListText(
  scopeLabel: string,
  layouts: LayoutSummary[],
  sort: LayoutSort,
  direction: LayoutSortDirection,
  awardContext: LayoutListAwardContext,
): string {
  const sortLabel = sort === "name" ? undefined : SORT_LABELS[sort];
  const directionLabel =
    direction === defaultSortDirection(sort) ? undefined : direction;
  const headerParts = [scopeLabel];
  if (sortLabel) headerParts.push(sortLabel);
  if (directionLabel) headerParts.push(directionLabel);
  const header = headerParts.join(" · ");

  if (layouts.length === 0) {
    return [header, `${ROW_INDENT}(no layouts)`].join("\n");
  }

  const names = layouts.map((layout) => displayLayoutName(layout.name));
  const awards = layouts.map((layout) =>
    awardBadgesForLayout(layout.name, awardContext),
  );
  const nameWidth = Math.max(4, ...names.map((name) => name.length));
  const awardsWidth = Math.max(0, ...awards.map((badge) => badge.length));

  if (sort === "name") {
    const body = layouts
      .map((layout, index) => {
        const name = names[index]!.padEnd(nameWidth);
        const badge = awards[index]!.padStart(awardsWidth);
        return `${ROW_INDENT}${name}${AWARDS_COLUMN_GAP}${badge}`.trimEnd();
      })
      .join("\n");
    return [header, body].join("\n");
  }

  const valueForLayout = (layout: LayoutSummary): string => {
    if (sort === "likes") return String(layout.like_count ?? 0);
    if (sort === "created") return formatLayoutDate(layout.created_at);
    return formatLayoutDate(layout.modified_at);
  };
  const values = layouts.map(valueForLayout);
  const valueWidth = Math.max(1, ...values.map((value) => value.length));

  const body = layouts
    .map((layout, index) => {
      const name = names[index]!.padEnd(nameWidth);
      const value = values[index]!.padStart(valueWidth);
      const badge = awards[index]!.padStart(awardsWidth);
      return `${ROW_INDENT}${name}${NAME_COLUMN_GAP}${value}${AWARDS_COLUMN_GAP}${badge}`.trimEnd();
    })
    .join("\n");

  return [header, body].join("\n");
}

function listQuery(scope: LayoutListScope, limit: number, offset: number) {
  return scope.userId
    ? listLayouts({ user: scope.userId, limit, offset })
    : listLayouts({ limit, offset });
}

export const layoutsCommand: Command = {
  name: "layouts",
  description: "List layouts, optionally filtered by author or name",
  usage: `${PREFIX}layouts [author] [--search QUERY] [--sort name|likes|created|modified] [--asc|--desc] [--limit N] [--page N]`,
  examples: [
    `${PREFIX}layouts`,
    `${PREFIX}layouts --sort likes`,
    `${PREFIX}layouts --sort created`,
    `${PREFIX}layouts --sort created --asc`,
    `${PREFIX}layouts --sort modified --desc`,
    `${PREFIX}layouts --search opal`,
    `${PREFIX}layouts galileotime`,
    `${PREFIX}layouts galileotime --search sturdy --sort likes --page 2`,
  ],
  async execute({ message, args }) {
    let authorQuery = "";
    let searchQuery = "";
    let limit = DEFAULT_LAYOUT_LIST_LIMIT;
    let page = 1;
    let sort: LayoutSort = "name";
    let sortDirection: LayoutSortDirection = "asc";

    try {
      const { positional, flags } = parseCommandArgs(args, {
        asc: true,
        desc: true,
        limit: true,
        page: true,
        search: true,
        sort: true,
      });

      if (positional.length > 1) {
        await replyUsage({ message, args }, layoutsCommand);
        return;
      }

      authorQuery = positional[0]?.trim() ?? "";
      searchQuery = flags.search?.trim() ?? "";

      if (flags.limit !== undefined) limit = flags.limit;
      if (flags.page !== undefined) page = flags.page;
      sort = parseLayoutSort(flags.sort);
      sortDirection = parseSortDirection(flags.asc, flags.desc, sort);
    } catch (error) {
      if (error instanceof FlagParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    limit = clampLimit(limit);
    page = clampPage(page);

    let corpus: string;
    try {
      corpus = await resolveCorpus(message.author.id);
    } catch (error) {
      if (error instanceof CorpusError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    try {
      let scope: LayoutListScope;

      if (authorQuery) {
        const author = await resolveAuthorUserId(authorQuery);
        if (!author) {
          await replyEmbed(
            message,
            errorEmbed(
              `Unknown author \`${authorQuery}\`. Author names are case-insensitive but must match exactly.`,
            ),
          );
          return;
        }

        scope = {
          label: author.name,
          title: author.name,
          userId: author.id,
        };
      } else {
        scope = {
          label: "all",
          title: "All layouts",
        };
      }

      if (searchQuery) {
        scope = {
          ...scope,
          label: scope.userId
            ? `${scope.label} · ${searchQuery}`
            : `search: ${searchQuery}`,
          title: scope.userId
            ? `${scope.title} · "${searchQuery}"`
            : `Search: ${searchQuery}`,
        };
      }

      const useClientList =
        sort !== "name" ||
        Boolean(searchQuery) ||
        sortDirection !== defaultSortDirection(sort);
      let layouts: LayoutSummary[];
      let total: number;

      if (useClientList) {
        layouts = await listAllLayouts(scope.userId ? { user: scope.userId } : {});
        if (searchQuery) {
          layouts = filterLayoutsBySearch(layouts, searchQuery);
        }
        layouts = sortLayouts(layouts, sort, sortDirection);
        total = layouts.length;
      } else {
        const response = await listQuery(scope, limit, (page - 1) * limit);
        total = response.total;
        layouts = response.layouts;
      }

      if (total === 0) {
        const emptyMessage = searchQuery
          ? scope.userId
            ? `\`${scope.label}\` has no matching layouts.`
            : `No layouts matching \`${searchQuery}\`.`
          : scope.userId
            ? `\`${scope.label}\` has no layouts.`
            : "No layouts found.";

        await replyEmbed(message, infoEmbed("Layouts", emptyMessage));
        return;
      }

      let pageCount = Math.max(1, Math.ceil(total / limit));
      let safePage = Math.min(page, pageCount);
      let pageLayouts = layouts;

      if (useClientList) {
        ({ items: pageLayouts, pageCount, safePage } = paginateLayouts(
          layouts,
          limit,
          page,
        ));
      } else if (safePage !== page) {
        ({ layouts: pageLayouts } = await listQuery(
          scope,
          limit,
          (safePage - 1) * limit,
        ));
      }

      const shouldRefreshLikesAwards =
        sort === "likes" && !scope.userId && !searchQuery;

      if (shouldRefreshLikesAwards) {
        const likesAwardData = await buildLikesAwardData();
        await refreshLikesAwards(
          likesAwardData.tierLayouts,
          likesAwardData.crownLayout,
        );
      }

      const [corpusAwards, likesAwards] = await Promise.all([
        loadCorpusAwards(corpus),
        loadLikesAwards(),
      ]);
      const awardContext: LayoutListAwardContext = {
        corpusAwards,
        likesAwards,
      };

      let text = formatLayoutListText(
        scope.label,
        pageLayouts,
        sort,
        sortDirection,
        awardContext,
      );
      let footerLimit = limit;
      let footerPageCount = pageCount;

      if (!fitsInCodeBlock(text)) {
        const reducedLimit = Math.min(limit, 15);
        const reduced = useClientList
          ? paginateLayouts(layouts, reducedLimit, safePage)
          : {
              items: (
                await listQuery(scope, reducedLimit, (safePage - 1) * reducedLimit)
              ).layouts,
              pageCount: Math.max(1, Math.ceil(total / reducedLimit)),
            };

        text = formatLayoutListText(
          scope.label,
          reduced.items,
          sort,
          sortDirection,
          awardContext,
        );
        footerLimit = reducedLimit;
        footerPageCount = reduced.pageCount;

        if (!fitsInCodeBlock(text)) {
          await replyEmbed(
            message,
            errorEmbed(
              "Layout list is too long for Discord. Try a smaller limit or page.",
            ),
          );
          return;
        }
      }

      await replyEmbed(
        message,
        infoEmbed(`Layouts · ${scope.title}`, textCodeBlock(text)).setFooter({
          text: formatPaginationFooter({
            page: safePage,
            pageCount: footerPageCount,
            limit: footerLimit,
            total,
          }),
        }),
      );
    } catch (error) {
      if (error instanceof LayoutApiError) {
        await replyLoggedError(
          message,
          "Failed to list layouts:",
          error,
          "Failed to list layouts",
        );
        return;
      }

      await replyLoggedError(
        message,
        "Failed to list layouts:",
        error,
        "Failed to list layouts",
      );
    }
  },
};
