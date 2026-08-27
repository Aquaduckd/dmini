import { LayoutApiError, LayoutNotFoundError } from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import { errorEmbed, replyEmbed } from "../discord/embeds.js";
import { replyLoggedError } from "../discord/errors.js";
import { CorpusError } from "../mana2/corpus.js";
import { Mana2Error } from "../mana2/cli.js";
import { presentLayout } from "../layout/present.js";
import { NoMatchingLayoutsError, pickRandomLayout } from "../layout/random.js";

export const randomCommand: Command = {
  name: "random",
  description: "Show a random keyboard layout",
  usage: `${PREFIX}random [--magic|--thumb|--regular] [--heatmap|--fingermap]`,
  examples: [
    `${PREFIX}random`,
    `${PREFIX}random --magic`,
    `${PREFIX}random --thumb --heatmap`,
    `${PREFIX}random --regular`,
  ],
  async execute({ message, args }) {
    let layoutFilter: "magic" | "thumb" | "regular" | undefined;
    let renderModeFlag: "fingermap" | "heatmap" | undefined;

    try {
      const { positional, flags } = parseCommandArgs(args, {
        layoutFilter: true,
        renderMode: true,
      });

      if (positional.length > 0) {
        await replyUsage({ message, args }, randomCommand);
        return;
      }

      layoutFilter = flags.layoutFilter;
      renderModeFlag = flags.renderMode;
    } catch (error) {
      if (error instanceof FlagParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    try {
      const layout = await pickRandomLayout(layoutFilter ?? "all");
      await presentLayout(message, layout, { renderModeFlag });
    } catch (error) {
      if (error instanceof NoMatchingLayoutsError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }

      if (error instanceof LayoutNotFoundError) {
        await replyEmbed(message, errorEmbed(error.formatMessage()));
        return;
      }

      if (error instanceof CorpusError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }

      if (error instanceof LayoutApiError || error instanceof Mana2Error) {
        await replyLoggedError(
          message,
          "Failed to render random layout:",
          error,
          "Failed to render random layout",
        );
        return;
      }

      if (error instanceof Error && error.message.includes("has no keys")) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }

      await replyLoggedError(
        message,
        "Failed to render random layout:",
        error,
        "Failed to render random layout",
      );
    }
  },
};
