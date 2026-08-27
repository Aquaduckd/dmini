import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import {
  createLayout,
  fetchLayoutDoc,
  formatWriteApiError,
  LayoutAlreadyExistsError,
  LayoutApiError,
  LayoutNotFoundError,
} from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import {
  LayoutNameError,
  normalizeLayoutName,
  validateLayoutName,
} from "../layout/name.js";
import {
  isStaggeredBoard,
  layoutToRenderKeys,
  missingAnalysisCharacters,
  type LayoutDoc,
} from "../layout/types.js";
import { resolveFingermapPalette } from "../config/user.js";
import { Colors, errorEmbed, replyEmbed } from "../discord/embeds.js";
import { renderKeyboardPng } from "../render/keyboard.js";

export const copyCommand: Command = {
  name: "copy",
  description: "Copy a layout under a new name",
  usage: `${PREFIX}copy <layout> <copy-name>`,
  group: "Editing",
  examples: [`${PREFIX}copy sturdy my-sturdy`],
  async execute({ message, args }) {
    const parts = args.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      await replyUsage({ message, args }, copyCommand);
      return;
    }

    const sourceName = parts[0]!;
    const copyName = normalizeLayoutName(parts.slice(1));

    if (sourceName.toLowerCase() === copyName) {
      await replyEmbed(
        message,
        errorEmbed("The copy name must be different from the source layout."),
      );
      return;
    }

    try {
      validateLayoutName(copyName);
    } catch (error) {
      if (error instanceof LayoutNameError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    let layout: LayoutDoc;

    try {
      const source = await fetchLayoutDoc(sourceName);
      layout = {
        name: copyName,
        board: source.board,
        user: message.author.id,
        keys: structuredClone(source.keys),
        ...(source.magic?.length ? { magic: structuredClone(source.magic) } : {}),
      };

      await createLayout({
        name: layout.name,
        board: layout.board,
        user: message.author.id,
        keys: layout.keys,
        magic: layout.magic,
      });
    } catch (error) {
      if (error instanceof LayoutNotFoundError) {
        await replyEmbed(message, errorEmbed(error.formatMessage()));
        return;
      }

      if (error instanceof LayoutAlreadyExistsError) {
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

      console.error("Failed to copy layout:", error);
      await replyEmbed(message, errorEmbed("Failed to copy layout."));
      return;
    }

    const missing = missingAnalysisCharacters(layout);
    const renderKeys = layoutToRenderKeys(layout);
    const fingermapPalette = await resolveFingermapPalette(message.author.id);
    const png = renderKeyboardPng(renderKeys, isStaggeredBoard(layout.board), {
      mode: "fingermap",
      fingermapPalette,
    });
    const filename = `${copyName}.png`;
    const attachment = new AttachmentBuilder(png, { name: filename });
    const embed = new EmbedBuilder()
      .setColor(Colors.primary)
      .setTitle(`Copied ${sourceName} → ${copyName}`)
      .setAuthor({ name: message.author.username })
      .setImage(`attachment://${filename}`)
      .setDescription(
        missing.length === 0
          ? "Layout copied and ready to analyze."
          : `Layout copied. Missing for analysis: ${missing.map((character) => `\`${character}\``).join(", ")}.`,
      )
      .setFooter({ text: `Board: ${layout.board}` });

    await replyEmbed(message, embed, { files: [attachment] });
  },
};
