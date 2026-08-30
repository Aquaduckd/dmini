import { AttachmentBuilder } from "discord.js";
import { resolveLayoutAuthor } from "../api/authors.js";
import { fetchLayoutDoc, LayoutApiError, LayoutNotFoundError } from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import { resolveCorpus } from "../config/user.js";
import { errorEmbed, replyEmbed } from "../discord/embeds.js";
import { replyLoggedError } from "../discord/errors.js";
import {
  isStaggeredBoard,
  layoutToRenderKeys,
} from "../layout/types.js";
import { analyzeLayout, Mana2Error } from "../mana2/analyze.js";
import { CorpusError } from "../mana2/corpus.js";
import { buildCompareEmbed } from "../mana2/format.js";
import { renderKeyboardPng } from "../render/keyboard.js";

export const compareCommand: Command = {
  name: "compare",
  description: "Compare two layouts and show stat deltas (new − old)",
  usage: `${PREFIX}compare <new_layout> <old_layout> [--corpus <name>]`,
  examples: [
    `${PREFIX}compare gallium qwerty`,
    `${PREFIX}compare rightroll sturdy --corpus monkeyracer`,
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

    const newName = positional[0]?.trim();
    const oldName = positional[1]?.trim();
    if (!oldName || !newName || positional.length > 2) {
      await replyUsage({ message, args }, compareCommand);
      return;
    }

    if (oldName.toLowerCase() === newName.toLowerCase()) {
      await replyEmbed(
        message,
        errorEmbed("Choose two different layouts to compare."),
      );
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
      const [oldLayout, newLayout] = await Promise.all([
        fetchLayoutDoc(oldName),
        fetchLayoutDoc(newName),
      ]);

      const [newKeys, oldKeys] = [
        layoutToRenderKeys(newLayout),
        layoutToRenderKeys(oldLayout),
      ];
      if (newKeys.length === 0) {
        await replyEmbed(
          message,
          errorEmbed(`Layout \`${newLayout.name}\` has no keys.`),
        );
        return;
      }

      const [oldAnalysis, newAnalysis, author] = await Promise.all([
        analyzeLayout(oldLayout, { corpus }),
        analyzeLayout(newLayout, { corpus }),
        resolveLayoutAuthor(newLayout.user),
      ]);

      const png = renderKeyboardPng(newKeys, isStaggeredBoard(newLayout.board), {
        mode: "compare",
        compareOldKeys: oldKeys,
      });

      const filename = `${newLayout.name.toLowerCase()}-vs-${oldLayout.name.toLowerCase()}.png`;
      const attachment = new AttachmentBuilder(png, { name: filename });
      const embed = buildCompareEmbed(
        oldLayout.name,
        newLayout.name,
        oldAnalysis,
        newAnalysis,
        filename,
        corpus,
        author,
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
          "Failed to compare layouts:",
          error,
          "Failed to compare layouts",
        );
        return;
      }

      await replyLoggedError(
        message,
        "Failed to compare layouts:",
        error,
        "Failed to compare layouts",
      );
    }
  },
};
