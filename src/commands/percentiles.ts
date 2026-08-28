import { AttachmentBuilder } from "discord.js";
import { resolveLayoutAuthor } from "../api/authors.js";
import { fetchLayoutDoc, LayoutApiError, LayoutNotFoundError } from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import type { Command } from "../command/types.js";
import { replyUsage } from "../command/format.js";
import { resolveCorpus, resolveFingermapPalette, resolveRenderMode } from "../config/user.js";
import { isAdmin } from "../config/admins.js";
import { errorEmbed, replyEmbed } from "../discord/embeds.js";
import { replyLoggedError } from "../discord/errors.js";
import {
  isStaggeredBoard,
  layoutLikeCount,
  layoutNotAnalyzableMessage,
  layoutToRenderKeys,
  missingAnalysisCharacters,
} from "../layout/types.js";
import { getLayoutStats } from "../mana2/cache.js";
import { Mana2Error } from "../mana2/analyze.js";
import { CorpusError } from "../mana2/corpus.js";
import { buildPercentilesEmbed } from "../mana2/format.js";
import { loadCorpusMonograms } from "../mana2/monograms.js";
import { loadResolvedCorpusPercentileCutoffs } from "../mana2/percentiles.js";
import { buildHeatContext } from "../render/heatmap.js";
import { renderKeyboardPng } from "../render/keyboard.js";

export const percentilesCommand: Command = {
  name: "percentiles",
  description: "Show layout stat percentiles against the corpus",
  usage: `${PREFIX}percentiles <name> [--corpus <name>]`,
  examples: [
    `${PREFIX}percentiles qwerty`,
    `${PREFIX}percentiles gallium --corpus monkeyracer`,
  ],
  async execute({ message, args }) {
    let positional: string[];
    let corpusFlag: string | undefined;

    try {
      ({ positional, flags: { corpus: corpusFlag } } = parseCommandArgs(args, {
        corpus: true,
      }));
    } catch (error) {
      if (error instanceof FlagParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    const name = positional[0]?.trim();
    if (!name || positional.length > 1) {
      await replyUsage({ message, args }, percentilesCommand);
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
      const layout = await fetchLayoutDoc(name);
      const keys = layoutToRenderKeys(layout);

      if (keys.length === 0) {
        await replyEmbed(message, errorEmbed(`Layout \`${name}\` has no keys.`));
        return;
      }

      const missing = missingAnalysisCharacters(layout);
      if (missing.length > 0) {
        await replyEmbed(
          message,
          errorEmbed(layoutNotAnalyzableMessage(layout.name, missing)),
        );
        return;
      }

      const [renderMode, fingermapPalette] = await Promise.all([
        resolveRenderMode(message.author.id),
        resolveFingermapPalette(message.author.id),
      ]);

      const [analysis, percentileTable, monograms, author] = await Promise.all([
        getLayoutStats(layout, corpus),
        loadResolvedCorpusPercentileCutoffs(corpus),
        renderMode === "heatmap"
          ? loadCorpusMonograms(corpus)
          : Promise.resolve(undefined),
        resolveLayoutAuthor(layout.user),
      ]);

      if (!percentileTable) {
        const userIsAdmin = await isAdmin(message.author.id);
        const messageText = userIsAdmin
          ? `No percentile cutoffs found for corpus \`${corpus}\`. Run \`${PREFIX}debug cache warm ${corpus}\`, then \`${PREFIX}debug percentiles ${corpus}\`.`
          : `Percentile data isn't available for corpus \`${corpus}\` yet. Ask a server admin to rebuild it.`;
        await replyEmbed(message, errorEmbed(messageText));
        return;
      }

      const heat =
        monograms !== undefined
          ? buildHeatContext(monograms, keys)
          : undefined;

      const png = renderKeyboardPng(keys, isStaggeredBoard(layout.board), {
        mode: renderMode,
        heat,
        fingermapPalette,
      });

      const filename = `${name.toLowerCase()}.png`;
      const attachment = new AttachmentBuilder(png, { name: filename });
      const embed = buildPercentilesEmbed(
        layout.name,
        analysis,
        percentileTable.stats,
        filename,
        percentileTable.corpus,
        author,
        layoutLikeCount(layout),
        percentileTable.layout_count,
        layout.link,
      );

      await replyEmbed(message, embed, { files: [attachment] });
    } catch (error) {
      if (error instanceof LayoutNotFoundError) {
        await replyEmbed(message, errorEmbed(error.formatMessage()));
        return;
      }

      if (error instanceof LayoutApiError || error instanceof Mana2Error) {
        await replyLoggedError(
          message,
          "Failed to show layout percentiles:",
          error,
          "Failed to show layout percentiles",
        );
        return;
      }

      await replyLoggedError(
        message,
        "Failed to show layout percentiles:",
        error,
        "Failed to show layout percentiles",
      );
    }
  },
};
