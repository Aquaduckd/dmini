import {
  fetchLayoutDoc,
  formatWriteApiError,
  LayoutApiError,
  LayoutNotFoundError,
  updateLayout,
} from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import {
  LayoutLinkError,
  layoutHasLink,
  normalizeLayoutLink,
} from "../layout/link.js";
import { layoutOwnedByUser } from "../layout/types.js";
import { errorEmbed, infoEmbed, replyEmbed } from "../discord/embeds.js";
import { replyLoggedError } from "../discord/errors.js";

async function loadOwnedLayout(
  name: string,
  userId: string,
): Promise<Awaited<ReturnType<typeof fetchLayoutDoc>> | null> {
  const layout = await fetchLayoutDoc(name);

  if (!layoutOwnedByUser(layout, userId)) {
    return null;
  }

  return layout;
}

export const setlinkCommand: Command = {
  name: "setlink",
  description: "Set, update, or clear the external link on one of your layouts",
  usage: `${PREFIX}setlink <layout> <url> | ${PREFIX}setlink <layout> --clear`,
  examples: [
    `${PREFIX}setlink opal https://forum.colemak.com/t/opal/123`,
    `${PREFIX}setlink opal --clear`,
  ],
  async execute({ message, args }) {
    let name = "";
    let clear = false;
    let urlInput = "";

    try {
      const { positional, flags } = parseCommandArgs(args, { clear: true });
      name = positional[0]?.trim() ?? "";
      clear = flags.clear ?? false;
      urlInput = positional.slice(1).join(" ");
    } catch (error) {
      if (error instanceof FlagParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    if (!name) {
      await replyUsage({ message, args }, setlinkCommand);
      return;
    }

    if (clear) {
      if (urlInput) {
        await replyEmbed(
          message,
          errorEmbed("Use either a URL or `--clear`, not both."),
        );
        return;
      }

      try {
        const layout = await loadOwnedLayout(name, message.author.id);
        if (!layout) {
          await replyEmbed(
            message,
            errorEmbed(`You don't own any layout named \`${name}\`.`),
          );
          return;
        }

        if (!layoutHasLink(layout.link)) {
          await replyEmbed(
            message,
            errorEmbed(`\`${layout.name}\` does not have a link.`),
          );
          return;
        }

        layout.link = "";
        await updateLayout(layout);
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
          "Failed to clear layout link:",
          error,
          "Failed to clear layout link",
        );
        return;
      }

      await replyEmbed(
        message,
        infoEmbed("Link removed", `The link has been removed from \`${name}\`.`),
      );
      return;
    }

    if (!urlInput) {
      await replyUsage({ message, args }, setlinkCommand);
      return;
    }

    let url: string;
    try {
      url = normalizeLayoutLink(urlInput);
    } catch (error) {
      if (error instanceof LayoutLinkError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    try {
      const layout = await loadOwnedLayout(name, message.author.id);
      if (!layout) {
        await replyEmbed(
          message,
          errorEmbed(`You don't own any layout named \`${name}\`.`),
        );
        return;
      }

      layout.link = url;
      await updateLayout(layout);
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
        "Failed to set layout link:",
        error,
        "Failed to set layout link",
      );
      return;
    }

    await replyEmbed(
      message,
      infoEmbed("Link updated", `\`${name}\` now links to ${url}.`),
    );
  },
};
