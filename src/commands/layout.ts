import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { resolveLayoutAuthor } from "../api/authors.js";
import { fetchLayoutDoc, LayoutApiError, LayoutNotFoundError } from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import type { Command } from "../command/types.js";
import { replyUsage } from "../command/format.js";
import { resolveCorpus, resolveFingermapPalette, resolveRenderMode } from "../config/user.js";
import { Colors, errorEmbed, replyEmbed } from "../discord/embeds.js";
import { CorpusError } from "../mana2/corpus.js";
import { Mana2Error } from "../mana2/cli.js";
import { loadCorpusMonograms } from "../mana2/monograms.js";
import { isStaggeredBoard, layoutLikeCount, layoutToRenderKeys, formatLikeCount } from "../layout/types.js";
import { buildHeatContext } from "../render/heatmap.js";
import { renderKeyboardPng } from "../render/keyboard.js";

export const layoutCommand: Command = {
  name: "layout",
  description: "Show a keyboard layout",
  usage: `${PREFIX}layout <name> [--heatmap|--fingermap]`,
  group: "Layouts",
  aliases: ["view"],
  examples: [
    `${PREFIX}layout qwerty`,
    `${PREFIX}layout gallium --heatmap`,
  ],
  async execute({ message, args }) {
    let positional: string[];
    let renderModeFlag: "fingermap" | "heatmap" | undefined;

    try {
      ({
        positional,
        flags: { renderMode: renderModeFlag },
      } = parseCommandArgs(args, { renderMode: true }));
    } catch (error) {
      if (error instanceof FlagParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    const name = positional[0]?.trim();
    if (!name || positional.length > 1) {
      await replyUsage({ message, args }, layoutCommand);
      return;
    }

    try {
      const layout = await fetchLayoutDoc(name);
      const keys = layoutToRenderKeys(layout);

      if (keys.length === 0) {
        await replyEmbed(message, errorEmbed(`Layout \`${name}\` has no keys.`));
        return;
      }

      const [author, renderMode, fingermapPalette] = await Promise.all([
        resolveLayoutAuthor(layout.user),
        resolveRenderMode(message.author.id, renderModeFlag),
        resolveFingermapPalette(message.author.id),
      ]);
      let corpus: string | undefined;
      let heat;

      if (renderMode === "heatmap") {
        corpus = await resolveCorpus(message.author.id);
        const monograms = await loadCorpusMonograms(corpus);
        heat = buildHeatContext(monograms, keys);
      }

      const png = renderKeyboardPng(keys, isStaggeredBoard(layout.board), {
        mode: renderMode,
        heat,
        fingermapPalette,
      });
      const filename = `${name.toLowerCase()}.png`;
      const attachment = new AttachmentBuilder(png, { name: filename });
      const embed = new EmbedBuilder()
        .setColor(Colors.primary)
        .setTitle(layout.name)
        .setImage(`attachment://${filename}`);

      if (author) {
        embed.setAuthor({ name: author });
      }

      const footerParts = [formatLikeCount(layoutLikeCount(layout))];
      if (renderMode === "heatmap" && corpus) {
        footerParts.push(`Heatmap · ${corpus} corpus`);
      }
      embed.setFooter({ text: footerParts.join(" · ") });

      await replyEmbed(message, embed, { files: [attachment] });
    } catch (error) {
      if (error instanceof LayoutNotFoundError) {
        await replyEmbed(message, errorEmbed(error.formatMessage()));
        return;
      }

      if (error instanceof LayoutApiError) {
        await replyEmbed(
          message,
          errorEmbed(`API error (${error.status}): ${error.message}`),
        );
        return;
      }

      if (error instanceof CorpusError || error instanceof Mana2Error) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }

      console.error("Failed to render layout:", error);
      await replyEmbed(message, errorEmbed("Failed to render layout."));
    }
  },
};
