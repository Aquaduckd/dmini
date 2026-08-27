import { AttachmentBuilder } from "discord.js";
import { resolveLayoutAuthor } from "../api/authors.js";
import { fetchLayoutDoc, LayoutApiError, LayoutNotFoundError } from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import type { Command } from "../command/types.js";
import { replyUsage } from "../command/format.js";
import { resolveCorpus, resolveFingermapPalette, resolveRenderMode } from "../config/user.js";
import { errorEmbed, replyEmbed } from "../discord/embeds.js";
import { replyLoggedError } from "../discord/errors.js";
import {
  isStaggeredBoard,
  layoutLikeCount,
  layoutNotAnalyzableMessage,
  layoutToRenderKeys,
  missingAnalysisCharacters,
} from "../layout/types.js";
import { analyzeLayout, Mana2Error } from "../mana2/analyze.js";
import { CorpusError } from "../mana2/corpus.js";
import { buildAnalysisEmbed } from "../mana2/format.js";
import { loadCorpusMonograms } from "../mana2/monograms.js";
import { ensureCorpusPercentileCutoffs } from "../mana2/percentiles.js";
import { buildHeatContext } from "../render/heatmap.js";
import { renderKeyboardPng } from "../render/keyboard.js";

export const analyzeCommand: Command = {
  name: "analyze",
  aliases: ["analyse"],
  description: "Analyze a keyboard layout",
  usage: `${PREFIX}analyze <name> [--corpus <name>] [--heatmap|--fingermap]`,
  examples: [
    `${PREFIX}analyze qwerty`,
    `${PREFIX}analyze gallium --corpus reddit`,
    `${PREFIX}analyze gallium --heatmap`,
  ],
  async execute({ message, args }) {
    let positional: string[];
    let corpusFlag: string | undefined;
    let renderModeFlag: "fingermap" | "heatmap" | undefined;

    try {
      ({
        positional,
        flags: { corpus: corpusFlag, renderMode: renderModeFlag },
      } = parseCommandArgs(args, {
        corpus: true,
        renderMode: true,
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
      await replyUsage({ message, args }, analyzeCommand);
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
        resolveRenderMode(message.author.id, renderModeFlag),
        resolveFingermapPalette(message.author.id),
      ]);

      const [analysis, percentileTable, monograms, author] = await Promise.all([
        analyzeLayout(layout, { corpus }),
        ensureCorpusPercentileCutoffs(corpus),
        renderMode === "heatmap"
          ? loadCorpusMonograms(corpus)
          : Promise.resolve(undefined),
        resolveLayoutAuthor(layout.user),
      ]);

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
      const embed = buildAnalysisEmbed(
        layout.name,
        analysis,
        filename,
        corpus,
        author,
        layoutLikeCount(layout),
        percentileTable.stats,
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
          "Failed to analyze layout:",
          error,
          "Failed to analyze layout",
        );
        return;
      }

      await replyLoggedError(
        message,
        "Failed to analyze layout:",
        error,
        "Failed to analyze layout",
      );
    }
  },
};
