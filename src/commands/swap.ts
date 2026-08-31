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
import { replyLoggedError } from "../discord/errors.js";
import { renderKeyboardPng } from "../render/keyboard.js";

export const swapCommand: Command = {
  name: "swap",
  description: "Cycle key positions on one of your layouts",
  usage: `${PREFIX}swap <layout> <cycle1> [cycle2] ...`,
  notes:
    "Each cycle rotates characters around, e.g. `sc` swaps `s` and `c`, `abc` cycles a→b→c→a. " +
    "One character per cycle may be absent from the layout to replace a key, e.g. `a@` puts `@` where `a` was.",
  examples: [
    `${PREFIX}swap colemak sc`,
    `${PREFIX}swap mylayout sc ae th`,
    `${PREFIX}swap mylayout abc`,
    `${PREFIX}swap mylayout a@`,
  ],
  async execute({ message, args }) {
    const parts = args.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      await replyUsage({ message, args }, swapCommand);
      return;
    }

    const name = parts[0]!;
    const cycles = parts.slice(1);

    try {
      const layout = await fetchLayoutDoc(name);

      if (!layoutOwnedByUser(layout, message.author.id)) {
        await replyEmbed(
          message,
          errorEmbed(`You don't own any layout named \`${name}\`.`),
        );
        return;
      }

      applySwaps(layout, cycles);
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
        .setTitle(`Updated ${layout.name}`)
        .setAuthor({ name: message.author.username })
        .setImage(`attachment://${filename}`)
        .setDescription(
          cycles.length === 1
            ? `Applied cycle \`${cycles[0]}\`.`
            : `Applied ${cycles.length} cycles: ${cycles.map((cycle) => `\`${cycle}\``).join(", ")}.`,
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

      await replyLoggedError(
        message,
        "Failed to swap layout:",
        error,
        "Failed to update layout",
      );
    }
  },
};
