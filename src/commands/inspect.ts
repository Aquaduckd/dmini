import { loadAuthorsByName } from "../api/authors.js";
import {
  fetchLayoutDoc,
  LayoutApiError,
  LayoutNotFoundError,
} from "../api/layouts.js";
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
  displayLayoutName,
} from "./layouts.js";

function resolveLikeNames(
  likes: Array<string | number>,
  authorsById: Map<string, string>,
): string[] {
  const names = likes.map((id) => {
    const key = String(id);
    return authorsById.get(key) ?? key;
  });

  return names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

async function buildAuthorsById(): Promise<Map<string, string>> {
  const authors = await loadAuthorsByName();
  const byId = new Map<string, string>();

  for (const [name, id] of Object.entries(authors)) {
    byId.set(String(id), name);
  }

  return byId;
}

export const inspectCommand: Command = {
  name: "inspect",
  description: "Inspect layout metadata",
  usage: `${PREFIX}inspect <layout> --likes [--limit N] [--page N]`,
  examples: [
    `${PREFIX}inspect opal --likes`,
    `${PREFIX}inspect gallium --likes --page 2`,
  ],
  async execute({ message, args }) {
    let layoutName = "";
    let showLikes = false;
    let limit = DEFAULT_LAYOUT_LIST_LIMIT;
    let page = 1;

    try {
      const { positional, flags } = parseCommandArgs(args, {
        likes: true,
        limit: true,
        page: true,
      });

      if (positional.length !== 1) {
        await replyUsage({ message, args }, inspectCommand);
        return;
      }

      layoutName = positional[0]!.trim();
      showLikes = flags.likes === true;
      if (flags.limit !== undefined) limit = flags.limit;
      if (flags.page !== undefined) page = flags.page;
    } catch (error) {
      if (error instanceof FlagParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    if (!layoutName) {
      await replyUsage({ message, args }, inspectCommand);
      return;
    }

    if (!showLikes) {
      await replyEmbed(
        message,
        errorEmbed(
          "Specify what to inspect. Currently supported: `--likes`.",
          "Missing flag",
        ),
      );
      return;
    }

    limit = clampLimit(limit);
    page = clampPage(page);

    try {
      const layout = await fetchLayoutDoc(layoutName);
      const likes = layout.likes ?? [];

      if (likes.length === 0) {
        await replyEmbed(
          message,
          infoEmbed(
            `Inspect · ${displayLayoutName(layout.name)}`,
            "No one has liked this layout yet.",
          ),
        );
        return;
      }

      const authorsById = await buildAuthorsById();
      const likeNames = resolveLikeNames(likes, authorsById);
      const title = `Inspect · ${displayLayoutName(layout.name)} — likes (${likeNames.length})`;
      const pageCount = Math.max(1, Math.ceil(likeNames.length / limit));

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
          kind: "inspect-likes",
          state: {
            layoutName: layout.name,
            likeNames,
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
      if (error instanceof LayoutNotFoundError) {
        await replyEmbed(message, errorEmbed(error.formatMessage()));
        return;
      }

      if (error instanceof LayoutApiError) {
        await replyLoggedError(
          message,
          "Failed to inspect layout:",
          error,
          "Failed to inspect layout",
        );
        return;
      }

      await replyLoggedError(
        message,
        "Failed to inspect layout:",
        error,
        "Failed to inspect layout",
      );
    }
  },
};
