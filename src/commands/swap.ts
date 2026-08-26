import { AttachmentBuilder, EmbedBuilder } from "discord.js";
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
import { applySwaps, SwapError } from "../layout/swap.js";
import {
  isStaggeredBoard,
  layoutOwnedByUser,
  layoutToRenderKeys,
} from "../layout/types.js";
import { resolveFingermapPalette } from "../config/user.js";
import { Colors, errorEmbed, replyEmbed } from "../discord/embeds.js";
import { renderKeyboardPng } from "../render/keyboard.js";

export const swapCommand: Command = {
  name: "swap",
  description: "Swap key positions on one of your layouts",
  usage: `${PREFIX}swap <layout> <swap1> [swap2] ...`,
  notes: "Each swap is two letters whose positions are exchanged, e.g. `sc` swaps `s` and `c`.",
  examples: [
    `${PREFIX}swap colemak sc`,
    `${PREFIX}swap mylayout sc ae th`,
  ],
  async execute({ message, args }) {
    const parts = args.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      await replyUsage({ message, args }, swapCommand);
      return;
    }

    const name = parts[0]!;
    const pairs = parts.slice(1);

    try {
      const layout = await fetchLayoutDoc(name);

      if (!layoutOwnedByUser(layout, message.author.id)) {
        await replyEmbed(
          message,
          errorEmbed(`You don't own any layout named \`${name}\`.`),
        );
        return;
      }

      applySwaps(layout, pairs);
      await updateLayout(layout);

      const renderKeys = layoutToRenderKeys(layout);
      const fingermapPalette = await resolveFingermapPalette(message.author.id);
      const png = renderKeyboardPng(
        renderKeys,
        isStaggeredBoard(layout.board),
        {
          mode: "fingermap",
          fingermapPalette,
        },
      );
      const filename = `${layout.name}.png`;
      const attachment = new AttachmentBuilder(png, { name: filename });
      const embed = new EmbedBuilder()
        .setColor(Colors.primary)
        .setTitle(`Swapped ${layout.name}`)
        .setAuthor({ name: message.author.username })
        .setImage(`attachment://${filename}`)
        .setDescription(
          pairs.length === 1
            ? `Swapped \`${pairs[0]![0]}\` and \`${pairs[0]![1]}\`.`
            : `Applied ${pairs.length} swaps: ${pairs.map((pair) => `\`${pair}\``).join(", ")}.`,
        )
        .setFooter({ text: `Board: ${layout.board}` });

      await replyEmbed(message, embed, { files: [attachment] });
    } catch (error) {
      if (error instanceof LayoutNotFoundError) {
        await replyEmbed(message, errorEmbed(error.formatMessage()));
        return;
      }

      if (error instanceof SwapError) {
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

      console.error("Failed to swap layout:", error);
      await replyEmbed(message, errorEmbed("Failed to update layout."));
    }
  },
};
