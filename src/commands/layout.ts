import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { resolveLayoutAuthor } from "../api/authors.js";
import { fetchLayoutDoc, LayoutApiError, LayoutNotFoundError } from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import type { Command } from "../command/types.js";
import { replyUsage } from "../command/format.js";
import { resolveCorpus, resolveFingermapPalette, resolveRenderMode } from "../config/user.js";
import { Colors, errorEmbed, replyEmbed } from "../discord/embeds.js";
import { replyLoggedError } from "../discord/errors.js";
import { CorpusError } from "../mana2/corpus.js";
import { Mana2Error } from "../mana2/cli.js";
import {
  formatLayoutAwardBadges,
  loadCorpusAwards,
  loadLikesAwards,
} from "../mana2/awards.js";
import { layoutHasMagicRules, layoutHasThumbKeys } from "../mana2/convert.js";
import { loadCorpusMonograms } from "../mana2/monograms.js";
import { formatMagicRuleCount } from "../layout/magic.js";
import { isStaggeredBoard, layoutLikeCount, layoutToRenderKeys, formatLikeCount, formatLayoutCreatedAt } from "../layout/types.js";
import { buildHeatContext } from "../render/heatmap.js";
import { renderKeyboardPng } from "../render/keyboard.js";

export const layoutCommand: Command = {
  name: "layout",
  aliases: ["view"],
  description: "Show a keyboard layout",
  usage: `${PREFIX}layout <name> [--heatmap|--fingermap]`,
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

      const corpus = await resolveCorpus(message.author.id);
      const [author, renderMode, fingermapPalette, awards, likesAwards] =
        await Promise.all([
        resolveLayoutAuthor(layout.user),
        resolveRenderMode(message.author.id, renderModeFlag),
        resolveFingermapPalette(message.author.id),
        loadCorpusAwards(corpus),
        loadLikesAwards(),
      ]);
      let heat;

      if (renderMode === "heatmap") {
        const monograms = await loadCorpusMonograms(corpus);
        heat = buildHeatContext(monograms, keys);
      }

      const awardBadges = formatLayoutAwardBadges(layout.name, awards, {
        likesAwards,
        hasMagic: layoutHasMagicRules(layout),
        hasThumbs: layoutHasThumbKeys(layout),
      });
      const title = awardBadges
        ? `${layout.name} ${awardBadges}`
        : layout.name;

      const png = renderKeyboardPng(keys, isStaggeredBoard(layout.board), {
        mode: renderMode,
        heat,
        fingermapPalette,
      });
      const filename = `${name.toLowerCase()}.png`;
      const attachment = new AttachmentBuilder(png, { name: filename });
      const embed = new EmbedBuilder()
        .setColor(Colors.primary)
        .setTitle(title)
        .setImage(`attachment://${filename}`);

      if (author) {
        embed.setAuthor({ name: author });
      }

      const footerParts = [formatLikeCount(layoutLikeCount(layout))];
      const createdAt = formatLayoutCreatedAt(layout.created_at);
      if (createdAt) {
        footerParts.push(createdAt);
      }
      const magicRuleCount = layout.magic?.length ?? 0;
      if (magicRuleCount > 0) {
        footerParts.push(formatMagicRuleCount(magicRuleCount));
      }
      if (renderMode === "heatmap") {
        footerParts.push(`Heatmap · ${corpus} corpus`);
      }
      embed.setFooter({ text: footerParts.join(" · ") });

      await replyEmbed(message, embed, { files: [attachment] });
    } catch (error) {
      if (error instanceof LayoutNotFoundError) {
        await replyEmbed(message, errorEmbed(error.formatMessage()));
        return;
      }

      if (error instanceof CorpusError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }

      if (error instanceof LayoutApiError || error instanceof Mana2Error) {
        await replyLoggedError(
          message,
          "Failed to render layout:",
          error,
          "Failed to render layout",
        );
        return;
      }

      await replyLoggedError(
        message,
        "Failed to render layout:",
        error,
        "Failed to render layout",
      );
    }
  },
};
