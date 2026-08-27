import {
  fetchLayoutDoc,
  formatWriteApiError,
  LayoutApiError,
  LayoutNotFoundError,
  updateLayout,
} from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { replyUsage } from "../command/format.js";
import type { Command, CommandContext } from "../command/types.js";
import { errorEmbed, infoEmbed, replyEmbed } from "../discord/embeds.js";
import { replyLoggedError } from "../discord/errors.js";
import {
  addLayoutLike,
  isQwertyLayout,
  removeLayoutLike,
} from "../layout/likes.js";
import { formatLikeCount, layoutLikeCount, type LayoutDoc } from "../layout/types.js";

async function executeLikeMutation(
  { message, args }: CommandContext,
  command: Command,
  action: "like" | "unlike",
): Promise<void> {
  const name = args.trim();
  if (!name) {
    await replyUsage({ message, args }, command);
    return;
  }

  try {
    const layout = await fetchLayoutDoc(name);

    if (action === "like" && isQwertyLayout(layout.name)) {
      await replyEmbed(message, errorEmbed("You can't like Qwerty 🟡"));
      return;
    }

    const userId = message.author.id;
    let updated: LayoutDoc;

    if (action === "like") {
      const result = addLayoutLike(layout, userId);
      if (!result.added) {
        await replyEmbed(
          message,
          errorEmbed("You've already liked this layout."),
        );
        return;
      }
      updated = result.layout;
    } else {
      const result = removeLayoutLike(layout, userId);
      if (!result.removed) {
        await replyEmbed(
          message,
          errorEmbed("You haven't liked this layout."),
        );
        return;
      }
      updated = result.layout;
    }

    const saved = await updateLayout(updated);
    const count = layoutLikeCount(saved);

    await replyEmbed(
      message,
      infoEmbed(
        action === "like" ? "Layout liked ❤️" : "Layout unliked 💔",
        action === "like"
          ? `You liked \`${saved.name}\`. (${formatLikeCount(count)})`
          : `You unliked \`${saved.name}\`. (${formatLikeCount(count)})`,
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
      `Failed to ${action} layout:`,
      error,
      `Failed to ${action} layout`,
    );
  }
}

export const likeCommand: Command = {
  name: "like",
  description: "Like a layout",
  usage: `${PREFIX}like <layout>`,
  examples: [`${PREFIX}like sturdy`],
  execute(context) {
    return executeLikeMutation(context, likeCommand, "like");
  },
};

export const unlikeCommand: Command = {
  name: "unlike",
  description: "Remove your like from a layout",
  usage: `${PREFIX}unlike <layout>`,
  examples: [`${PREFIX}unlike sturdy`],
  execute(context) {
    return executeLikeMutation(context, unlikeCommand, "unlike");
  },
};
