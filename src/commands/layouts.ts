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

export const DEFAULT_LAYOUT_LIST_LIMIT = 20;
export const MAX_LAYOUT_LIST_LIMIT = 50;

export type LayoutSort = "name" | "likes";

interface LayoutListScope {
  label: string;
  title: string;
  userId?: string;
}

const ROW_INDENT = "  ";
const NAME_LIKES_GAP = "  ";
const MAX_LAYOUT_NAME_LENGTH = 32;

function displayLayoutName(name: string): string {
  if (name.length <= MAX_LAYOUT_NAME_LENGTH) return name;
  if (MAX_LAYOUT_NAME_LENGTH <= 1) return "…";
  return `${name.slice(0, MAX_LAYOUT_NAME_LENGTH - 1)}…`;
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_LAYOUT_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LAYOUT_LIST_LIMIT);
}

function clampPage(page: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.max(Math.trunc(page), 1);
}

function parseLayoutSort(value?: string): LayoutSort {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "name") return "name";
  if (normalized === "likes") return "likes";
  throw new FlagParseError("Sort must be `name` or `likes`.");
}

function filterLayoutsBySearch(
  layouts: LayoutSummary[],
  query: string,
): LayoutSummary[] {
  const trimmed = query.trim();
  if (!trimmed) return layouts;
  return layouts.filter((layout) => layoutMatchesSearch(layout.name, trimmed));
}

function sortLayouts(layouts: LayoutSummary[], sort: LayoutSort): LayoutSummary[] {
  if (sort === "likes") {
    return [...layouts].sort((a, b) => {
      const diff = (b.like_count ?? 0) - (a.like_count ?? 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
  }

  return [...layouts].sort((a, b) => a.name.localeCompare(b.name));
}

function paginateLayouts(
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
  page: number,
  pageCount: number,
  sort: LayoutSort,
): string {
  const header =
    sort === "likes"
      ? `${scopeLabel} · likes · page ${page}/${pageCount}`
      : `${scopeLabel} · page ${page}/${pageCount}`;

  if (layouts.length === 0) {
    return [header, `${ROW_INDENT}(no layouts)`].join("\n");
  }

  if (sort !== "likes") {
    const body = layouts
      .map((layout) => `${ROW_INDENT}${displayLayoutName(layout.name)}`)
      .join("\n");
    return [header, body].join("\n");
  }

  const names = layouts.map((layout) => displayLayoutName(layout.name));
  const nameWidth = Math.max(0, ...names.map((name) => name.length));
  const likesWidth = Math.max(
    1,
    ...layouts.map((layout) => String(layout.like_count ?? 0).length),
  );

  const body = layouts
    .map((layout, index) => {
      const likes = String(layout.like_count ?? 0);
      return `${ROW_INDENT}${names[index]!.padEnd(nameWidth)}${NAME_LIKES_GAP}${likes.padStart(likesWidth)}`;
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
  usage: `${PREFIX}layouts [author] [--search QUERY] [--sort name|likes] [--limit N] [--page N]`,
  examples: [
    `${PREFIX}layouts`,
    `${PREFIX}layouts --sort likes`,
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

    try {
      const { positional, flags } = parseCommandArgs(args, {
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
    } catch (error) {
      if (error instanceof FlagParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    limit = clampLimit(limit);
    page = clampPage(page);

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

      const useClientList = sort === "likes" || Boolean(searchQuery);
      let layouts: LayoutSummary[];
      let total: number;

      if (useClientList) {
        layouts = await listAllLayouts(scope.userId ? { user: scope.userId } : {});
        if (searchQuery) {
          layouts = filterLayoutsBySearch(layouts, searchQuery);
        }
        layouts = sortLayouts(layouts, sort);
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

      let text = formatLayoutListText(
        scope.label,
        pageLayouts,
        safePage,
        pageCount,
        sort,
      );

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
          safePage,
          reduced.pageCount,
          sort,
        );

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

      const footerSort = sort === "likes" ? " · likes" : "";

      await replyEmbed(
        message,
        infoEmbed(`Layouts · ${scope.title}`, textCodeBlock(text)).setFooter({
          text: `Page ${safePage}/${pageCount} · ${limit} per page · ${total} total${footerSort}`,
        }),
      );
    } catch (error) {
      if (error instanceof LayoutApiError) {
        await replyEmbed(
          message,
          errorEmbed(`API error (${error.status}): ${error.message}`),
        );
        return;
      }

      console.error("Failed to list layouts:", error);
      await replyEmbed(message, errorEmbed("Failed to list layouts."));
    }
  },
};
