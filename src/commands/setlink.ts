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
  description: "Set or update the external link on one of your layouts",
  usage: `${PREFIX}setlink <layout> <url>`,
  examples: [
    `${PREFIX}setlink opal https://forum.colemak.com/t/opal/123`,
  ],
  async execute({ message, args }) {
    const parts = args.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      await replyUsage({ message, args }, setlinkCommand);
      return;
    }

    const name = parts[0]!;
    const urlInput = parts.slice(1).join(" ");

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

export const clearlinkCommand: Command = {
  name: "clearlink",
  description: "Remove the external link from one of your layouts",
  usage: `${PREFIX}clearlink <layout>`,
  examples: [`${PREFIX}clearlink opal`],
  async execute({ message, args }) {
    const name = args.trim();
    if (!name) {
      await replyUsage({ message, args }, clearlinkCommand);
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
  },
};
