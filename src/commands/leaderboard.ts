import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import { resolveCorpus } from "../config/user.js";
import { isAdmin } from "../config/admins.js";
import {
  errorEmbed,
  infoEmbed,
  replyEmbed,
} from "../discord/embeds.js";
import {
  PaginatedContentTooLongError,
  replyPaginated,
} from "../discord/paginationButtons.js";
import { replyLoggedError } from "../discord/errors.js";
import { CorpusError } from "../mana2/corpus.js";
import {
  refreshBoardAwards,
} from "../mana2/awards.js";
import {
  buildAwardsLeaderboardSnapshot,
  buildLeaderboardSnapshot,
  formatLeaderboardValue,
  leaderboardFilterLabel,
  type LeaderboardResult,
} from "../mana2/leaderboard.js";
import { PercentileCutoffsMissingError } from "../mana2/percentiles.js";
import { resolveStatId } from "../mana2/stats.js";
import type { LayoutSortDirection } from "./layouts.js";
import {
  clampLimit,
  clampPage,
  DEFAULT_LAYOUT_LIST_LIMIT,
  displayLayoutName,
  parseSortDirection,
  ROW_INDENT,
} from "./layouts.js";

const VALUE_GAP = "  ";
const BADGES_COLUMN_GAP = "  ";

export function formatLeaderboardText(
  result: LeaderboardResult,
  page: number,
  limit: number,
  direction: LayoutSortDirection = "desc",
): string {
  const filterLabel = leaderboardFilterLabel(result.filter);
  const filterPart = result.filter === "all" ? "" : ` · ${filterLabel}`;
  const directionPart = direction === "desc" ? "" : ` · ${direction}`;

  const header =
    result.mode === "overall"
      ? `Top layouts overall (${result.corpus})${filterPart}${directionPart}`
      : result.mode === "awards"
        ? `Top layouts by awards (${result.corpus})${filterPart}${directionPart}`
        : `Top layouts by ${result.stat!.label} (${result.corpus})${filterPart}${directionPart}`;

  const meta =
    result.mode === "overall"
      ? `Avg percentile across ${result.overallStatCount} stats · ${result.layoutCount} layouts`
      : result.mode === "awards"
        ? `${result.layoutCount} layouts with awards`
        : `${result.layoutCount} layouts`;

  if (result.entries.length === 0) {
    return [header, meta, `${ROW_INDENT}(no layouts)`].join("\n");
  }

  const startRank = (page - 1) * limit + 1;
  const rankWidth = String(startRank + result.entries.length - 1).length;
  const nameWidth = Math.max(
    ...result.entries.map((entry) => displayLayoutName(entry.name).length),
    4,
  );
  const valueWidth = Math.max(
    ...result.entries.map((entry) =>
      formatLeaderboardValue(result, entry.value).length,
    ),
    result.mode === "overall" ? 4 : 1,
  );
  const badgesWidth =
    result.mode === "awards"
      ? Math.max(
          0,
          ...result.entries.map((entry) => entry.badges?.length ?? 0),
        )
      : 0;

  const body = result.entries
    .map((entry, index) => {
      const rank = startRank + index;
      const rankLabel = `${rank}.`.padStart(rankWidth + 1);
      const name = displayLayoutName(entry.name).padEnd(nameWidth);
      const value = formatLeaderboardValue(result, entry.value).padStart(
        valueWidth,
      );
      if (result.mode === "awards") {
        const badges = (entry.badges ?? "").padStart(badgesWidth);
        return `${ROW_INDENT}${rankLabel} ${name}${VALUE_GAP}${value}${BADGES_COLUMN_GAP}${badges}`.trimEnd();
      }
      return `${ROW_INDENT}${rankLabel} ${name}${VALUE_GAP}${value}`;
    })
    .join("\n");

  return [header, meta, body].join("\n");
}

export const leaderboardCommand: Command = {
  name: "leaderboard",
  aliases: ["lb", "top"],
  description: "Rank layouts by a stat, overall average percentile, or award count",
  usage: `${PREFIX}leaderboard [stat|awards] [--magic|--thumb|--regular] [--corpus NAME] [--asc|--desc] [--limit N] [--page N]`,
  notes:
    "Omit the stat for overall ranking (average percentile across bigram and trigram stats). Use `awards` to rank layouts by total badge count. Requires a warmed analysis cache and percentile cutoffs built by a server admin.",
  examples: [
    `${PREFIX}leaderboard sfb`,
    `${PREFIX}leaderboard awards`,
    `${PREFIX}leaderboard roll --thumb`,
    `${PREFIX}leaderboard sfb --asc`,
    `${PREFIX}leaderboard --magic --limit 10`,
    `${PREFIX}leaderboard --regular`,
    `${PREFIX}leaderboard alt --corpus reddit --page 2`,
  ],
  async execute({ message, args }) {
    let statInput: string | undefined;
    let corpusFlag: string | undefined;
    let layoutFilter: "magic" | "thumb" | "regular" | undefined;
    let limit = DEFAULT_LAYOUT_LIST_LIMIT;
    let page = 1;
    let sortDirection: LayoutSortDirection = "desc";

    try {
      const { positional, flags } = parseCommandArgs(args, {
        asc: true,
        corpus: true,
        desc: true,
        layoutFilter: true,
        limit: true,
        page: true,
      });

      if (positional.length > 1) {
        await replyUsage({ message, args }, leaderboardCommand);
        return;
      }

      statInput = positional[0]?.trim() || undefined;
      corpusFlag = flags.corpus;
      layoutFilter = flags.layoutFilter;
      limit = clampLimit(flags.limit ?? DEFAULT_LAYOUT_LIST_LIMIT);
      page = clampPage(flags.page ?? 1);
      sortDirection = parseSortDirection(flags.asc, flags.desc, "likes");
    } catch (error) {
      if (error instanceof FlagParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    let corpus: string;

    try {
      corpus = await resolveCorpus(message.author.id, corpusFlag);
    } catch (error) {
      if (error instanceof CorpusError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    const awardsMode = statInput?.toLowerCase() === "awards";
    const statId =
      statInput && !awardsMode ? resolveStatId(statInput) ?? undefined : undefined;
    if (statInput && !awardsMode && !statId) {
      await replyEmbed(
        message,
        errorEmbed(
          `Unknown stat \`${statInput}\`. Try values like \`sfb\`, \`roll\`, \`alt\`, \`awards\`, or \`lp\`.`,
        ),
      );
      return;
    }

    try {
      const userIsAdmin = await isAdmin(message.author.id);
      const filter = layoutFilter ?? "all";
      const snapshot = awardsMode
        ? await buildAwardsLeaderboardSnapshot({
            corpus,
            filter,
          })
        : await buildLeaderboardSnapshot({
            corpus,
            filter,
            statId,
          });

      if (!snapshot || snapshot.entries.length === 0) {
        const filterLabel = leaderboardFilterLabel(filter);
        const filterSuffix = layoutFilter ? ` (${filterLabel})` : "";
        const cacheMessage = awardsMode
          ? `No awards found for corpus \`${corpus}\`${filterSuffix}. View stat leaderboards or \`${PREFIX}layouts --sort likes\` first to populate awards.`
          : userIsAdmin
            ? `No cached layouts found for corpus \`${corpus}\`${filterSuffix}. Run \`${PREFIX}debug cache warm ${corpus}\` first.`
            : `Analysis cache isn't ready for corpus \`${corpus}\`${filterSuffix} yet. Ask a server admin to warm it.`;
        await replyEmbed(message, errorEmbed(cacheMessage));
        return;
      }

      const pageCount = Math.max(1, Math.ceil(snapshot.entries.length / limit));
      if (page > pageCount) {
        await replyEmbed(
          message,
          errorEmbed(`Page ${page} is out of range (max ${pageCount}).`),
        );
        return;
      }

      if (snapshot.awardData) {
        await refreshBoardAwards(
          snapshot.corpus,
          snapshot.awardData.board,
          snapshot.awardData.tierLayouts,
          snapshot.awardData.crownLayout,
        );
      }

      const entries =
        sortDirection === "asc"
          ? [...snapshot.entries].reverse()
          : snapshot.entries;

      try {
        await replyPaginated(message, {
          title: "Leaderboard",
          userId: message.author.id,
          initialPage: page,
          kind: "leaderboard",
          state: {
            corpus: snapshot.corpus,
            filter: snapshot.filter,
            mode: snapshot.mode,
            statId: snapshot.stat?.id,
            layoutCount: snapshot.layoutCount,
            overallStatCount: snapshot.overallStatCount,
            sortDirection,
            limit,
            entries,
          },
        });
      } catch (error) {
        if (error instanceof PaginatedContentTooLongError) {
          await replyEmbed(
            message,
            errorEmbed(
              "Leaderboard output is too long for Discord. Try a smaller limit.",
            ),
          );
          return;
        }

        await replyEmbed(
          message,
          errorEmbed("Failed to load this leaderboard page."),
        );
      }
    } catch (error) {
      if (error instanceof PercentileCutoffsMissingError) {
        const userIsAdmin = await isAdmin(message.author.id);
        const messageText = userIsAdmin
          ? `No percentile cutoffs found for corpus \`${error.corpus}\`. Run \`${PREFIX}debug cache warm ${error.corpus}\`, then \`${PREFIX}debug percentiles ${error.corpus}\`.`
          : `Percentile data isn't available for corpus \`${error.corpus}\` yet. Ask a server admin to rebuild it.`;
        await replyEmbed(message, errorEmbed(messageText));
        return;
      }

      await replyLoggedError(
        message,
        "Failed to build leaderboard:",
        error,
        "Failed to build leaderboard",
      );
    }
  },
};
