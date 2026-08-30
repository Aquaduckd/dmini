import {
  displayLayoutName,
  formatLayoutListText,
  paginateLayouts,
  ROW_INDENT,
  type LayoutListAwardContext,
} from "../../commands/layouts.js";
import { getStatDefinition } from "../../mana2/stats.js";
import {
  formatExamplesText,
  paginateExamples,
} from "../../mana2/examples.js";
import {
  loadCorpusAwards,
  loadLikesAwards,
} from "../../mana2/awards.js";
import { fitsInCodeBlock, textCodeBlock } from "../embeds.js";
import {
  PaginatedContentTooLongError,
  resolvePaginatedLimit,
} from "./limit.js";
import type {
  ExamplesPaginationState,
  InspectLikesPaginationState,
  LayoutsPaginationState,
  LeaderboardPaginationState,
  LikesPaginationState,
  PaginatedPage,
  PaginationSessionRecord,
} from "./types.js";

export interface RenderPaginationResult {
  page: PaginatedPage;
  effectiveLimit?: number;
}

function formatLikesListText(
  scopeLabel: string,
  layouts: { name: string }[],
): string {
  if (layouts.length === 0) {
    return [scopeLabel, `${ROW_INDENT}(no layouts)`].join("\n");
  }

  const body = layouts
    .map((layout) => `${ROW_INDENT}${displayLayoutName(layout.name)}`)
    .join("\n");

  return [scopeLabel, body].join("\n");
}

async function renderLayoutsPage(
  state: LayoutsPaginationState,
  targetPage: number,
  effectiveLimit?: number,
): Promise<RenderPaginationResult> {
  const [corpusAwards, likesAwards] = await Promise.all([
    loadCorpusAwards(state.corpus),
    loadLikesAwards(),
  ]);
  const awardContext: LayoutListAwardContext = {
    corpusAwards,
    likesAwards,
  };

  const buildPage = (pageLimit: number, page: number) => {
    const { items, pageCount, safePage } = paginateLayouts(
      state.allLayouts,
      pageLimit,
      page,
    );
    const text = formatLayoutListText(
      state.scope.label,
      items,
      state.sort,
      state.sortDirection,
      awardContext,
    );

    return {
      text,
      pagination: {
        page: safePage,
        pageCount,
        limit: pageLimit,
        total: state.allLayouts.length,
      },
    };
  };

  if (effectiveLimit !== undefined) {
    const resolved = buildPage(effectiveLimit, targetPage);
    return {
      page: {
        description: textCodeBlock(resolved.text),
        pagination: resolved.pagination,
      },
    };
  }

  const initial = await resolvePaginatedLimit(state.limit, async (pageLimit) => {
    return buildPage(pageLimit, targetPage).text;
  });
  const resolved = buildPage(initial.effectiveLimit, targetPage);

  return {
    page: {
      description: textCodeBlock(resolved.text),
      pagination: resolved.pagination,
    },
    effectiveLimit: initial.effectiveLimit,
  };
}

async function renderLikesPage(
  state: LikesPaginationState,
  targetPage: number,
  effectiveLimit?: number,
): Promise<RenderPaginationResult> {
  const buildPage = (pageLimit: number, page: number) => {
    const { items, pageCount, safePage } = paginateLayouts(
      state.allLayouts,
      pageLimit,
      page,
    );

    return {
      text: formatLikesListText(state.scopeLabel, items),
      pagination: {
        page: safePage,
        pageCount,
        limit: pageLimit,
        total: state.allLayouts.length,
      },
    };
  };

  if (effectiveLimit !== undefined) {
    const resolved = buildPage(effectiveLimit, targetPage);
    return {
      page: {
        description: textCodeBlock(resolved.text),
        pagination: resolved.pagination,
      },
    };
  }

  const initial = await resolvePaginatedLimit(state.limit, async (pageLimit) => {
    return buildPage(pageLimit, targetPage).text;
  });
  const resolved = buildPage(initial.effectiveLimit, targetPage);

  return {
    page: {
      description: textCodeBlock(resolved.text),
      pagination: resolved.pagination,
    },
    effectiveLimit: initial.effectiveLimit,
  };
}

async function renderInspectLikesPage(
  state: InspectLikesPaginationState,
  targetPage: number,
  effectiveLimit?: number,
): Promise<RenderPaginationResult> {
  const buildPage = (pageLimit: number, page: number) => {
    const total = state.likeNames.length;
    const pageCount = Math.max(1, Math.ceil(total / pageLimit));
    const safePage = Math.min(Math.max(page, 1), pageCount);
    const start = (safePage - 1) * pageLimit;
    const items = state.likeNames.slice(start, start + pageLimit);
    const body =
      items.length === 0
        ? `${ROW_INDENT}(no likes)`
        : items.map((name) => `${ROW_INDENT}${name}`).join("\n");

    return {
      text: body,
      pagination: {
        page: safePage,
        pageCount,
        limit: pageLimit,
        total,
      },
    };
  };

  if (effectiveLimit !== undefined) {
    const resolved = buildPage(effectiveLimit, targetPage);
    return {
      page: {
        description: textCodeBlock(resolved.text),
        pagination: resolved.pagination,
      },
    };
  }

  const initial = await resolvePaginatedLimit(state.limit, async (pageLimit) => {
    return buildPage(pageLimit, targetPage).text;
  });
  const resolved = buildPage(initial.effectiveLimit, targetPage);

  return {
    page: {
      description: textCodeBlock(resolved.text),
      pagination: resolved.pagination,
    },
    effectiveLimit: initial.effectiveLimit,
  };
}

async function renderLeaderboardPage(
  state: LeaderboardPaginationState,
  targetPage: number,
): Promise<RenderPaginationResult> {
  const { formatLeaderboardText } = await import("../../commands/leaderboard.js");
  const pageCount = Math.max(
    1,
    Math.ceil(state.entries.length / state.limit),
  );
  const safePage = Math.min(Math.max(targetPage, 1), pageCount);
  const offset = (safePage - 1) * state.limit;
  const pageEntries = state.entries.slice(offset, offset + state.limit);

  const text = formatLeaderboardText(
    {
      corpus: state.corpus,
      filter: state.filter,
      mode: state.mode,
      stat: state.statId ? getStatDefinition(state.statId) : undefined,
      layoutCount: state.layoutCount,
      totalEntries: state.entries.length,
      entries: pageEntries,
      overallStatCount: state.overallStatCount,
    },
    safePage,
    state.limit,
    state.sortDirection,
  );

  return {
    page: {
      description: fitsInCodeBlock(text) ? textCodeBlock(text) : text,
      pagination: {
        page: safePage,
        pageCount,
        limit: state.limit,
        total: state.entries.length,
      },
    },
  };
}

async function renderExamplesPage(
  state: ExamplesPaginationState,
  targetPage: number,
  effectiveLimit?: number,
): Promise<RenderPaginationResult> {
  if (effectiveLimit !== undefined) {
    const pagination = paginateExamples(
      state.layoutName,
      state.stat,
      state.examples,
      effectiveLimit,
      targetPage,
    );

    return {
      page: {
        description: textCodeBlock(formatExamplesText(pagination, state.corpus)),
        pagination,
      },
    };
  }

  const initial = await resolvePaginatedLimit(
    state.limit,
    async (tryLimit) => {
      const tryPagination = paginateExamples(
        state.layoutName,
        state.stat,
        state.examples,
        tryLimit,
        targetPage,
      );
      return formatExamplesText(tryPagination, state.corpus);
    },
    Math.min(state.limit, 20),
  );
  const pagination = paginateExamples(
    state.layoutName,
    state.stat,
    state.examples,
    initial.effectiveLimit,
    targetPage,
  );

  return {
    page: {
      description: textCodeBlock(formatExamplesText(pagination, state.corpus)),
      pagination,
    },
    effectiveLimit: initial.effectiveLimit,
  };
}

export async function renderPaginationPage(
  record: PaginationSessionRecord,
  targetPage: number,
): Promise<RenderPaginationResult> {
  switch (record.kind) {
    case "layouts":
      return renderLayoutsPage(
        record.state as LayoutsPaginationState,
        targetPage,
        record.effectiveLimit,
      );
    case "likes":
      return renderLikesPage(
        record.state as LikesPaginationState,
        targetPage,
        record.effectiveLimit,
      );
    case "inspect-likes":
      return renderInspectLikesPage(
        record.state as InspectLikesPaginationState,
        targetPage,
        record.effectiveLimit,
      );
    case "leaderboard":
      return renderLeaderboardPage(
        record.state as LeaderboardPaginationState,
        targetPage,
      );
    case "examples":
      return renderExamplesPage(
        record.state as ExamplesPaginationState,
        targetPage,
        record.effectiveLimit,
      );
    default:
      throw new PaginatedContentTooLongError();
  }
}
