import {
  deleteLayout,
  fetchLayoutDoc,
  formatWriteApiError,
  LayoutApiError,
  LayoutNotFoundError,
} from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import { layoutOwnedByUser } from "../layout/types.js";
import { errorEmbed, infoEmbed, replyEmbed } from "../discord/embeds.js";
import { replyLoggedError } from "../discord/errors.js";
import { deleteLayoutCache } from "../mana2/cache.js";

export const removeCommand: Command = {
  name: "remove",
  description: "Delete one of your layouts from the catalog",
  usage: `${PREFIX}remove <name>`,
  examples: [`${PREFIX}remove mylayout`],
  async execute({ message, args }) {
    const name = args.trim();
    if (!name) {
      await replyUsage({ message, args }, removeCommand);
      return;
    }

    try {
      const layout = await fetchLayoutDoc(name);

      if (!layoutOwnedByUser(layout, message.author.id)) {
        await replyEmbed(
          message,
          errorEmbed(`You don't own any layout named \`${name}\`.`),
        );
        return;
      }

      await deleteLayout(layout.name);
      await deleteLayoutCache(layout.name);
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
        "Failed to remove layout:",
        error,
        "Failed to remove layout",
      );
      return;
    }

    await replyEmbed(
      message,
      infoEmbed("Layout removed", `\`${name}\` has been removed.`),
    );
  },
};
