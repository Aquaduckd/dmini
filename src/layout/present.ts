import { AttachmentBuilder, EmbedBuilder, type Message } from "discord.js";
import { resolveLayoutAuthor } from "../api/authors.js";
import { resolveCorpus, resolveFingermapPalette, resolveRenderMode } from "../config/user.js";
import { Colors, replyEmbed } from "../discord/embeds.js";
import {
  formatLayoutAwardBadges,
  loadCorpusAwards,
  loadLikesAwards,
} from "../mana2/awards.js";
import { layoutHasMagicRules, layoutHasThumbKeys } from "../mana2/convert.js";
import { loadCorpusMonograms } from "../mana2/monograms.js";
import { layoutHasComboRules } from "./combos.js";
import { formatMagicRuleCount } from "./magic.js";
import {
  formatLayoutCreatedAt,
  formatLikeCount,
  isStaggeredBoard,
  layoutLikeCount,
  layoutToRenderKeys,
  type LayoutDoc,
} from "./types.js";
import { buildHeatContext } from "../render/heatmap.js";
import { renderKeyboardPng } from "../render/keyboard.js";
import { applyLayoutEmbedUrl } from "./link.js";

export async function presentLayout(
  message: Message,
  layout: LayoutDoc,
  options: {
    renderModeFlag?: "fingermap" | "heatmap";
  } = {},
): Promise<void> {
  const keys = layoutToRenderKeys(layout);
  if (keys.length === 0) {
    throw new Error(`Layout \`${layout.name}\` has no keys.`);
  }

  const corpus = await resolveCorpus(message.author.id);
  const [author, renderMode, fingermapPalette, awards, likesAwards] =
    await Promise.all([
      resolveLayoutAuthor(layout.user),
      resolveRenderMode(message.author.id, options.renderModeFlag),
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
    hasCombos: layoutHasComboRules(layout),
  });
  const title = awardBadges ? `${layout.name} ${awardBadges}` : layout.name;

  const png = renderKeyboardPng(keys, isStaggeredBoard(layout.board), {
    mode: renderMode,
    heat,
    fingermapPalette,
  });
  const filename = `${layout.name.toLowerCase()}.png`;
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
  applyLayoutEmbedUrl(embed, layout.link);

  await replyEmbed(message, embed, { files: [attachment] });
}
