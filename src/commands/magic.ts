import { AttachmentBuilder } from "discord.js";
import { resolveLayoutAuthor } from "../api/authors.js";
import { fetchLayoutDoc, LayoutApiError, LayoutNotFoundError } from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { parseCommandArgs } from "../command/flags.js";
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

export const magicCommand: Command = {
  name: "magic",
  description: "Show magic rules for a layout",
  usage: `${PREFIX}magic <name>`,
  aliases: ["magicrules"],
  examples: [`${PREFIX}magic opal`, `${PREFIX}magic gallium`],
  async execute({ message, args }) {
    const { positional } = parseCommandArgs(args);
    const name = positional[0]?.trim() ?? "";

    if (!name || positional.length > 1) {
      await replyUsage({ message, args }, magicCommand);
      return;
    }

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

      const body = formatMagicRulesText(rules);
      const footer = formatLikeCount(layoutLikeCount(layout));

      if (!fitsInCodeBlock(body)) {
        const attachment = new AttachmentBuilder(
          Buffer.from(body, "utf8"),
          { name: `${name.toLowerCase()}-magic.txt` },
        );
        const embed = infoEmbed(
          `${layout.name} · Magic rules`,
          `${rules.length} rules attached.`,
        );
        if (author) embed.setAuthor({ name: author });
        embed.setFooter({ text: footer });
        await replyEmbed(message, embed, { files: [attachment] });
        return;
      }

      const embed = infoEmbed(`${layout.name} · Magic rules`, textCodeBlock(body));
      if (author) embed.setAuthor({ name: author });
      embed.setFooter({ text: footer });
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
