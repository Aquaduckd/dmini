import { AttachmentBuilder } from "discord.js";
import { resolveLayoutAuthor } from "../api/authors.js";
import { fetchLayoutDoc, LayoutApiError, LayoutNotFoundError } from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import { formatMagicRulesText } from "../layout/magic.js";
import { formatLikeCount, layoutLikeCount } from "../layout/types.js";
import {
  errorEmbed,
  fitsInCodeBlock,
  infoEmbed,
  replyEmbed,
  textCodeBlock,
} from "../discord/embeds.js";
import { replyLoggedError } from "../discord/errors.js";

export const DEFAULT_MAGIC_LIST_LIMIT = 25;
export const MAX_MAGIC_LIST_LIMIT = 50;

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_MAGIC_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_MAGIC_LIST_LIMIT);
}

function clampPage(page: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.max(Math.trunc(page), 1);
}

function paginateRules<T>(items: T[], limit: number, page: number) {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const start = (safePage - 1) * limit;

  return {
    items: items.slice(start, start + limit),
    total,
    pageCount,
    safePage,
  };
}

export const magicCommand: Command = {
  name: "magic",
  description: "Show magic rules for a layout",
  usage: `${PREFIX}magic <name> [--limit N] [--page N]`,
  aliases: ["magicrules"],
  examples: [
    `${PREFIX}magic opal`,
    `${PREFIX}magic gallium --page 2`,
  ],
  async execute({ message, args }) {
    let name = "";
    let limitFlag: number | undefined;
    let page = 1;

    try {
      const { positional, flags } = parseCommandArgs(args, {
        limit: true,
        page: true,
      });

      name = positional[0]?.trim() ?? "";
      if (!name || positional.length > 1) {
        await replyUsage({ message, args }, magicCommand);
        return;
      }

      limitFlag = flags.limit;
      if (flags.page !== undefined) page = flags.page;
    } catch (error) {
      if (error instanceof FlagParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    page = clampPage(page);

    try {
      const layout = await fetchLayoutDoc(name);
      const author = await resolveLayoutAuthor(layout.user);

      const rules = layout.magic ?? [];
      if (rules.length === 0) {
        await replyEmbed(
          message,
          infoEmbed(
            layout.name,
            `\`${layout.name}\` has no magic rules.`,
          ),
        );
        return;
      }

      const limit = clampLimit(limitFlag ?? rules.length);
      const { items, total, pageCount, safePage } = paginateRules(
        rules,
        limit,
        page,
      );
      let body = formatMagicRulesText(items);
      let footer = `${total} rule${total === 1 ? "" : "s"}`;

      if (pageCount > 1) {
        footer = `Page ${safePage}/${pageCount} · ${limit} per page · ${footer}`;
      }

      if (!fitsInCodeBlock(body) && pageCount === 1) {
        const reduced = paginateRules(rules, 15, 1);
        body = formatMagicRulesText(reduced.items);
        footer = `Page 1/${Math.max(1, Math.ceil(total / 15))} · 15 per page · ${total} rules`;
      }

      if (!fitsInCodeBlock(body)) {
        const attachment = new AttachmentBuilder(
          Buffer.from(formatMagicRulesText(rules), "utf8"),
          { name: `${name.toLowerCase()}-magic.txt` },
        );
        const embed = infoEmbed(
          `${layout.name} · Magic rules`,
          `${total} rules attached.`,
        );
        if (author) embed.setAuthor({ name: author });
        embed.setFooter({ text: formatLikeCount(layoutLikeCount(layout)) });
        await replyEmbed(message, embed, { files: [attachment] });
        return;
      }

      const embed = infoEmbed(`${layout.name} · Magic rules`, textCodeBlock(body));
      if (author) embed.setAuthor({ name: author });
      embed.setFooter({
        text: [footer, formatLikeCount(layoutLikeCount(layout))].join(" · "),
      });
      await replyEmbed(message, embed);
    } catch (error) {
      if (error instanceof LayoutNotFoundError) {
        await replyEmbed(message, errorEmbed(error.formatMessage()));
        return;
      }

      if (error instanceof LayoutApiError) {
        await replyLoggedError(
          message,
          "Failed to fetch magic rules:",
          error,
          "Failed to fetch magic rules",
        );
        return;
      }

      await replyLoggedError(
        message,
        "Failed to fetch magic rules:",
        error,
        "Failed to fetch magic rules",
      );
    }
  },
};
