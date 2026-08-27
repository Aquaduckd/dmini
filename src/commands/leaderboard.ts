import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import { resolveCorpus } from "../config/user.js";
import { isAdmin } from "../config/admins.js";
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
import {
  refreshBoardAwards,
} from "../mana2/awards.js";
import {
  buildLeaderboard,
  formatLeaderboardValue,
  leaderboardFilterLabel,
  type LeaderboardResult,
} from "../mana2/leaderboard.js";
import { PercentileCutoffsMissingError } from "../mana2/percentiles.js";
import { resolveStatId } from "../mana2/stats.js";
import {
  clampLimit,
  clampPage,
  DEFAULT_LAYOUT_LIST_LIMIT,
  displayLayoutName,
  ROW_INDENT,
} from "./layouts.js";

const VALUE_GAP = "  ";

function formatLeaderboardText(
  result: LeaderboardResult,
  page: number,
  limit: number,
): string {
  const filterLabel = leaderboardFilterLabel(result.filter);
  const filterPart = result.filter === "all" ? "" : ` · ${filterLabel}`;

  const header =
    result.mode === "overall"
      ? `Top layouts overall (${result.corpus})${filterPart}`
      : `Top layouts by ${result.stat!.label} (${result.corpus})${filterPart}`;

  const meta =
    result.mode === "overall"
      ? `Avg percentile across ${result.overallStatCount} stats · ${result.layoutCount} layouts`
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
    result.mode === "overall" ? 4 : 3,
  );

  const body = result.entries
    .map((entry, index) => {
      const rank = startRank + index;
      const rankLabel = `${rank}.`.padStart(rankWidth + 1);
      const name = displayLayoutName(entry.name).padEnd(nameWidth);
      const value = formatLeaderboardValue(result, entry.value).padStart(
        valueWidth,
      );
      return `${ROW_INDENT}${rankLabel} ${name}${VALUE_GAP}${value}`;
    })
    .join("\n");

  return [header, meta, body].join("\n");
}

export const leaderboardCommand: Command = {
  name: "leaderboard",
  aliases: ["lb", "top"],
  description: "Rank layouts by a stat or overall average percentile",
  usage: `${PREFIX}leaderboard [stat] [--magic|--thumb|--regular] [--corpus NAME] [--limit N] [--page N]`,
  notes:
    "Omit the stat for overall ranking (average percentile across bigram and trigram stats). Requires a warmed analysis cache and percentile cutoffs built by a server admin.",
  examples: [
    `${PREFIX}leaderboard sfb`,
    `${PREFIX}leaderboard roll --thumb`,
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

    try {
      const { positional, flags } = parseCommandArgs(args, {
        corpus: true,
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

    const statId = statInput ? resolveStatId(statInput) ?? undefined : undefined;
    if (statInput && !statId) {
      await replyEmbed(
        message,
        errorEmbed(
          `Unknown stat \`${statInput}\`. Try values like \`sfb\`, \`roll\`, \`alt\`, or \`lp\`.`,
        ),
      );
      return;
    }

    try {
      const userIsAdmin = await isAdmin(message.author.id);
      const offset = (page - 1) * limit;
      const result = await buildLeaderboard({
        corpus,
        filter: layoutFilter ?? "all",
        statId,
        limit,
        offset,
      });

      if (!result) {
        const filterLabel = leaderboardFilterLabel(layoutFilter ?? "all");
        const filterSuffix = layoutFilter ? ` (${filterLabel})` : "";
        const cacheMessage = userIsAdmin
          ? `No cached layouts found for corpus \`${corpus}\`${filterSuffix}. Run \`${PREFIX}debug cache warm ${corpus}\` first.`
          : `Analysis cache isn't ready for corpus \`${corpus}\`${filterSuffix} yet. Ask a server admin to warm it.`;
        await replyEmbed(message, errorEmbed(cacheMessage));
        return;
      }

      const pageCount = Math.max(1, Math.ceil(result.totalEntries / limit));
      if (page > pageCount) {
        await replyEmbed(
          message,
          errorEmbed(`Page ${page} is out of range (max ${pageCount}).`),
        );
        return;
      }

      if (result.awardData) {
        await refreshBoardAwards(
          result.corpus,
          result.awardData.board,
          result.awardData.tierLayouts,
          result.awardData.crownLayout,
        );
      }

      const text = formatLeaderboardText(result, page, limit);

      const embed = infoEmbed("Leaderboard", fitsInCodeBlock(text) ? textCodeBlock(text) : text);
      embed.setFooter({
        text: formatPaginationFooter({
          page,
          pageCount,
          limit,
          total: result.totalEntries,
        }),
      });

      await replyEmbed(message, embed);
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
