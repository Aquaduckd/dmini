import {
  fetchLayoutDoc,
  formatWriteApiError,
  LayoutApiError,
  LayoutNotFoundError,
  updateLayout,
} from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import { layoutOwnedByUser } from "../layout/types.js";
import { errorEmbed, infoEmbed, replyEmbed } from "../discord/embeds.js";
import { replyLoggedError } from "../discord/errors.js";

export const clearmagicCommand: Command = {
  name: "clearmagic",
  description: "Remove all magic rules from one of your layouts",
  usage: `${PREFIX}clearmagic <layout>`,
  examples: [`${PREFIX}clearmagic opal`],
  async execute({ message, args }) {
    const layoutName = args.trim();
    if (!layoutName) {
      await replyUsage({ message, args }, clearmagicCommand);
      return;
    }

    try {
      const layout = await fetchLayoutDoc(layoutName);

      if (!layoutOwnedByUser(layout, message.author.id)) {
        await replyEmbed(
          message,
          errorEmbed(`You don't own any layout named \`${layoutName}\`.`),
        );
        return;
      }

      if (!layout.magic?.length) {
        await replyEmbed(
          message,
          infoEmbed(
            "No magic rules",
            `\`${layout.name}\` already has no magic rules.`,
          ),
        );
        return;
      }

      layout.magic = [];
      await updateLayout(layout);

      await replyEmbed(
        message,
        infoEmbed(
          "Magic rules cleared",
          `Removed all magic rules from \`${layout.name}\`.`,
        ),
      );
    } catch (error) {
      if (error instanceof LayoutNotFoundError) {
        await replyEmbed(message, errorEmbed(error.formatMessage()));
        return;
      }

      if (error instanceof LayoutApiError) {
        await replyEmbed(message, errorEmbed(formatWriteApiError(error)));
        return;
      }

      if (error instanceof Error && error.message.includes("LAYOUTAPI_TOKEN")) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }

      await replyLoggedError(
        message,
        "Failed to clear magic rules:",
        error,
        "Failed to clear magic rules",
      );
    }
  },
};
