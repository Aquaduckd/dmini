import { resolveAuthorUserId } from "../api/authors.js";
import { LayoutApiError, listLayouts } from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import {
  errorEmbed,
  infoEmbed,
  replyEmbed,
} from "../discord/embeds.js";
import {
  PaginatedContentTooLongError,
  replyPaginated,
} from "../discord/paginationButtons.js";
import { replyLoggedError } from "../discord/errors.js";
import {
  clampLimit,
  clampPage,
  DEFAULT_LAYOUT_LIST_LIMIT,
} from "./layouts.js";

export const likesCommand: Command = {
  name: "likes",
  description: "List layouts liked by you or another author",
  usage: `${PREFIX}likes [author] [--limit N] [--page N]`,
  examples: [
    `${PREFIX}likes`,
    `${PREFIX}likes clemenpine`,
    `${PREFIX}likes --page 2`,
  ],
  async execute({ message, args }) {
    let authorQuery = "";
    let limit = DEFAULT_LAYOUT_LIST_LIMIT;
    let page = 1;

    try {
      const { positional, flags } = parseCommandArgs(args, {
        limit: true,
        page: true,
      });

      if (positional.length > 1) {
        await replyUsage({ message, args }, likesCommand);
        return;
      }

      authorQuery = positional[0]?.trim() ?? "";
      if (flags.limit !== undefined) limit = flags.limit;
      if (flags.page !== undefined) page = flags.page;
    } catch (error) {
      if (error instanceof FlagParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    limit = clampLimit(limit);
    page = clampPage(page);

    let userId = message.author.id;
    let scopeLabel = "your likes";
    let title = "Your likes";

    if (authorQuery) {
      const author = await resolveAuthorUserId(authorQuery);
      if (!author) {
        await replyEmbed(
          message,
          errorEmbed(
            `Unknown author \`${authorQuery}\`. Author names are case-insensitive but must match exactly.`,
          ),
        );
        return;
      }

      userId = author.id;
      scopeLabel = `${author.name}'s likes`;
      title = `Likes · ${author.name}`;
    }

    try {
      const { total } = await listLayouts({ likedBy: userId, limit: 1 });
      if (total === 0) {
        const emptyMessage = authorQuery
          ? `\`${authorQuery}\` hasn't liked any layouts yet.`
          : "You haven't liked any layouts yet.";

        await replyEmbed(message, infoEmbed(title, emptyMessage));
        return;
      }

      const allLayouts = (
        await listLayouts({
          likedBy: userId,
          limit: total,
        })
      ).layouts;

      const pageCount = Math.max(1, Math.ceil(allLayouts.length / limit));
      if (page > pageCount) {
        await replyEmbed(
          message,
          errorEmbed(`Page ${page} is out of range (max ${pageCount}).`),
        );
        return;
      }

      try {
        await replyPaginated(message, {
          title,
          userId: message.author.id,
          initialPage: page,
          kind: "likes",
          state: {
            scopeLabel,
            allLayouts,
            limit,
          },
        });
      } catch (error) {
        if (error instanceof PaginatedContentTooLongError) {
          await replyEmbed(
            message,
            errorEmbed(
              "Like list is too long for Discord. Try a smaller limit or page.",
            ),
          );
          return;
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof LayoutApiError) {
        await replyLoggedError(
          message,
          "Failed to list liked layouts:",
          error,
          "Failed to list liked layouts",
        );
        return;
      }

      await replyLoggedError(
        message,
        "Failed to list liked layouts:",
        error,
        "Failed to list liked layouts",
      );
    }
  },
};
