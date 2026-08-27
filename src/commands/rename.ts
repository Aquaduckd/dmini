import {
  fetchLayoutDoc,
  formatWriteApiError,
  LayoutAlreadyExistsError,
  LayoutApiError,
  LayoutNotFoundError,
  renameLayout,
} from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import {
  LayoutNameError,
  normalizeLayoutName,
  validateLayoutName,
} from "../layout/name.js";
import { layoutOwnedByUser } from "../layout/types.js";
import { errorEmbed, infoEmbed, replyEmbed } from "../discord/embeds.js";
import { replyLoggedError } from "../discord/errors.js";

export const renameCommand: Command = {
  name: "rename",
  description: "Rename one of your layouts",
  usage: `${PREFIX}rename <old-name> <new-name>`,
  examples: [`${PREFIX}rename mylayout mylayout-v2`],
  async execute({ message, args }) {
    const parts = args.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      await replyUsage({ message, args }, renameCommand);
      return;
    }

    const oldName = parts[0]!;
    const newName = normalizeLayoutName(parts.slice(1));

    if (oldName.toLowerCase() === newName) {
      await replyEmbed(
        message,
        errorEmbed("The new name must be different from the old name."),
      );
      return;
    }

    try {
      validateLayoutName(newName);
    } catch (error) {
      if (error instanceof LayoutNameError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    try {
      const layout = await fetchLayoutDoc(oldName);

      if (!layoutOwnedByUser(layout, message.author.id)) {
        await replyEmbed(
          message,
          errorEmbed(`You don't own any layout named \`${oldName}\`.`),
        );
        return;
      }

      await renameLayout(layout.name, newName);
    } catch (error) {
      if (error instanceof LayoutNotFoundError) {
        await replyEmbed(message, errorEmbed(error.formatMessage()));
        return;
      }

      if (error instanceof LayoutAlreadyExistsError) {
        await replyEmbed(message, errorEmbed(error.message));
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
        "Failed to rename layout:",
        error,
        "Failed to rename layout",
      );
      return;
    }

    await replyEmbed(
      message,
      infoEmbed(
        "Layout renamed",
        `\`${oldName}\` has been renamed to \`${newName}\`.`,
      ),
    );
  },
};
