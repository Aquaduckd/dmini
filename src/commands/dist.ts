import { AttachmentBuilder } from "discord.js";
import { fetchLayoutDoc, LayoutApiError, LayoutNotFoundError } from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import { resolveCorpus } from "../config/user.js";
import { isAdmin } from "../config/admins.js";
import { Colors, errorEmbed, infoEmbed, replyEmbed } from "../discord/embeds.js";
import { replyLoggedError } from "../discord/errors.js";
import {
  layoutNotAnalyzableMessage,
  missingAnalysisCharacters,
} from "../layout/types.js";
import { getCorpusStatsIndex, getLayoutStats } from "../mana2/cache.js";
import { Mana2Error } from "../mana2/analyze.js";
import { CorpusError } from "../mana2/corpus.js";
import {
  formatLeaderboardStatValue,
  getStatDefinition,
  isLowerIsBetter,
  resolveStatId,
} from "../mana2/stats.js";
import { resolveDistRange, valueToPercentile } from "../render/distribution.js";
import { renderHistogramPng } from "../render/histogram.js";

export const distCommand: Command = {
  name: "dist",
  aliases: ["distribution"],
  description: "Show where a layout sits on a stat distribution",
  usage: `${PREFIX}dist <stat> <layout> [--corpus <name>] [--notail] [--min <value>] [--max <value>]`,
  examples: [
    `${PREFIX}dist vsb sturdy`,
    `${PREFIX}dist sfb gallium --corpus monkeyracer`,
    `${PREFIX}dist sfb opal --notail`,
    `${PREFIX}dist sfb opal --min 0 --max 15`,
  ],
  async execute({ message, args }) {
    let statInput = "";
    let layoutName = "";
    let corpusFlag: string | undefined;
    let rangeMin: number | undefined;
    let rangeMax: number | undefined;
    let notail = false;

    try {
      const { positional, flags } = parseCommandArgs(args, {
        corpus: true,
        min: true,
        max: true,
        notail: true,
      });

      if (positional.length !== 2) {
        await replyUsage({ message, args }, distCommand);
        return;
      }

      statInput = positional[0]!.trim();
      layoutName = positional[1]!.trim();
      corpusFlag = flags.corpus;
      rangeMin = flags.min;
      rangeMax = flags.max;
      notail = flags.notail === true;

      if (rangeMin !== undefined && rangeMax !== undefined && rangeMin >= rangeMax) {
        await replyEmbed(message, errorEmbed("`--min` must be less than `--max`."));
        return;
      }
    } catch (error) {
      if (error instanceof FlagParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    const statId = resolveStatId(statInput);
    if (!statId) {
      await replyEmbed(
        message,
        errorEmbed(`Unknown stat \`${statInput}\`. Try values like \`vsb\`, \`sfb\`, or \`roll\`.`),
      );
      return;
    }

    const stat = getStatDefinition(statId);
    if (!stat) {
      await replyEmbed(message, errorEmbed(`Unknown stat \`${statInput}\`.`));
      return;
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

    try {
      const layout = await fetchLayoutDoc(layoutName);
      const missing = missingAnalysisCharacters(layout);
      if (missing.length > 0) {
        await replyEmbed(
          message,
          errorEmbed(layoutNotAnalyzableMessage(layout.name, missing)),
        );
        return;
      }

      const [index, analysis] = await Promise.all([
        getCorpusStatsIndex(corpus),
        getLayoutStats(layout, corpus),
      ]);

      if (!index) {
        const userIsAdmin = await isAdmin(message.author.id);
        const messageText = userIsAdmin
          ? `No cached stats found for corpus \`${corpus}\`. Run \`${PREFIX}debug cache warm ${corpus}\` first.`
          : `Stat distribution data isn't available for corpus \`${corpus}\` yet. Ask a server admin to warm the cache.`;
        await replyEmbed(message, errorEmbed(messageText));
        return;
      }

      const layoutValue = analysis.values.get(statId);
      if (layoutValue === undefined) {
        await replyEmbed(
          message,
          errorEmbed(`Layout \`${layout.name}\` has no cached value for ${stat.label}.`),
        );
        return;
      }

      const values = Object.values(index.layouts)
        .map((stats) => stats[statId])
        .filter((value): value is number => value !== undefined);

      if (values.length < 2) {
        await replyEmbed(
          message,
          errorEmbed(
            `Not enough cached layouts with ${stat.label} data in corpus \`${corpus}\`.`,
          ),
        );
        return;
      }

      let effectiveMin: number | undefined;
      let effectiveMax: number | undefined;

      if (notail || rangeMin !== undefined || rangeMax !== undefined) {
        const range = resolveDistRange(values, {
          notail,
          min: rangeMin,
          max: rangeMax,
        });
        effectiveMin = range.min;
        effectiveMax = range.max;

        if (effectiveMax <= effectiveMin) {
          await replyEmbed(
            message,
            errorEmbed("The graph range is invalid. `--min` must be less than `--max`."),
          );
          return;
        }
      }

      const formatValue = (value: number) =>
        formatLeaderboardStatValue(stat, value);

      const png = renderHistogramPng({
        statLabel: stat.label,
        layoutName: layout.name,
        layoutValue,
        values,
        formatValue,
        rangeMin: effectiveMin,
        rangeMax: effectiveMax,
      });

      const filename = `${layout.name.toLowerCase()}-${stat.id}-dist.png`;
      const attachment = new AttachmentBuilder(png, { name: filename });

      const sorted = [...values].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)]!;
      const percentile = Math.round(valueToPercentile(values, layoutValue));
      const direction = isLowerIsBetter(statId) ? "lower" : "higher";

      const embed = infoEmbed(
        `${stat.label} · ${layout.name}`,
        [
          `**${formatValue(layoutValue)}** on the ${stat.label} distribution`,
          `${percentile}th percentile · median ${formatValue(median)}`,
          `${values.length.toLocaleString()} layouts · corpus \`${corpus}\``,
          `${direction} is better for this stat`,
        ].join("\n"),
      )
        .setColor(Colors.primary)
        .setImage(`attachment://${filename}`);

      await replyEmbed(message, embed, { files: [attachment] });
    } catch (error) {
      if (error instanceof LayoutNotFoundError) {
        await replyEmbed(message, errorEmbed(error.formatMessage()));
        return;
      }

      if (error instanceof LayoutApiError || error instanceof Mana2Error) {
        await replyLoggedError(
          message,
          "Failed to render stat distribution:",
          error,
          "Failed to render stat distribution",
        );
        return;
      }

      await replyLoggedError(
        message,
        "Failed to render stat distribution:",
        error,
        "Failed to render stat distribution",
      );
    }
  },
};
