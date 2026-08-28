import { AttachmentBuilder } from "discord.js";
import { resolveLayoutAuthor } from "../api/authors.js";
import { fetchLayoutDoc, LayoutApiError, LayoutNotFoundError } from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { parseCommandArgs } from "../command/flags.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import { formatCombosText } from "../layout/combos.js";
import { formatLikeCount, layoutLikeCount } from "../layout/types.js";
import {
  errorEmbed,
  fitsInCodeBlock,
  infoEmbed,
  replyEmbed,
  textCodeBlock,
} from "../discord/embeds.js";
import { replyLoggedError } from "../discord/errors.js";

export const combosCommand: Command = {
  name: "combos",
  description: "Show combos for a layout",
  usage: `${PREFIX}combos <name>`,
  examples: [`${PREFIX}combos opal`, `${PREFIX}combos gallium`],
  async execute({ message, args }) {
    const { positional } = parseCommandArgs(args);
    const name = positional[0]?.trim() ?? "";

    if (!name || positional.length > 1) {
      await replyUsage({ message, args }, combosCommand);
      return;
    }

    try {
      const layout = await fetchLayoutDoc(name);
      const author = await resolveLayoutAuthor(layout.user);

      const combos = layout.combos ?? [];
      if (combos.length === 0) {
        await replyEmbed(
          message,
          infoEmbed(layout.name, `\`${layout.name}\` has no combos.`),
        );
        return;
      }

      const body = formatCombosText(combos);
      const footer = formatLikeCount(layoutLikeCount(layout));

      if (!fitsInCodeBlock(body)) {
        const attachment = new AttachmentBuilder(Buffer.from(body, "utf8"), {
          name: `${name.toLowerCase()}-combos.txt`,
        });
        const embed = infoEmbed(
          `${layout.name} · Combos`,
          `${combos.length} combos attached.`,
        );
        if (author) embed.setAuthor({ name: author });
        embed.setFooter({ text: footer });
        await replyEmbed(message, embed, { files: [attachment] });
        return;
      }

      const embed = infoEmbed(`${layout.name} · Combos`, textCodeBlock(body));
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
          "Failed to fetch combos:",
          error,
          "Failed to fetch combos",
        );
        return;
      }

      await replyLoggedError(
        message,
        "Failed to fetch combos:",
        error,
        "Failed to fetch combos",
      );
    }
  },
};
