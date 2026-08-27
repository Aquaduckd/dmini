import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import {
  BOT_DEFAULT_CORPUS,
  DEFAULT_RENDER_MODE,
  type RenderMode,
  resetUserSettings,
  resolveCorpus,
  resolveFingermapPalette,
  resolveRenderMode,
  setUserCorpus,
  setUserFingermapPalette,
  setUserRenderMode,
} from "../config/user.js";
import { errorEmbed, infoEmbed, replyEmbed } from "../discord/embeds.js";
import { isAdmin } from "../config/admins.js";
import { CorpusError, listCorpora, resolveDownloadedCorpus } from "../mana2/corpus.js";
import {
  DEFAULT_FINGER_PALETTE,
  FINGER_PALETTES,
  FINGER_PALETTE_IDS,
  parseFingermapPalette,
} from "../render/fingermap.js";

function formatCorpusList(title: string, corpora: string[]): string {
  if (corpora.length === 0) return `${title}: (none)`;
  return `${title}:\n${corpora.map((name) => `- \`${name}\``).join("\n")}`;
}

function parseRenderMode(value: string): RenderMode | null {
  const normalized = value.toLowerCase();
  if (normalized === "fingermap" || normalized === "fingers") {
    return "fingermap";
  }
  if (normalized === "heatmap" || normalized === "heat") {
    return "heatmap";
  }
  return null;
}

export const configCommand: Command = {
  name: "config",
  description: "View or change your analysis settings",
  usage: `${PREFIX}config [corpus|render|palette [value]]`,
  examples: [
    `${PREFIX}config`,
    `${PREFIX}config corpus`,
    `${PREFIX}config corpus reddit`,
    `${PREFIX}config render heatmap`,
    `${PREFIX}config palette neon`,
    `${PREFIX}config reset`,
  ],
  async execute({ message, args }) {
    const userId = message.author.id;
    const trimmed = args.trim();

    if (!trimmed) {
      const [effectiveCorpus, renderMode, fingermapPalette] = await Promise.all([
        resolveCorpus(userId),
        resolveRenderMode(userId),
        resolveFingermapPalette(userId),
      ]);

      await replyEmbed(
        message,
        infoEmbed(
          "Your settings",
          [
            `**Corpus:** \`${effectiveCorpus}\``,
            `**Render:** \`${renderMode}\``,
            `**Palette:** \`${fingermapPalette}\` (${FINGER_PALETTES[fingermapPalette].label})`,
            "",
            `Override corpus per command with \`--corpus <name>\` on \`${PREFIX}analyze\` and \`${PREFIX}examples\`.`,
            `Change render mode with \`${PREFIX}config render fingermap|heatmap\`.`,
            `Change palette with \`${PREFIX}config palette cminibrowser|neon\`.`,
          ].join("\n"),
        ),
      );
      return;
    }

    if (trimmed.toLowerCase() === "reset") {
      await resetUserSettings(userId);
      await replyEmbed(
        message,
        infoEmbed(
          "Settings reset",
          `Your settings were cleared. Commands will use the bot default corpus (\`${BOT_DEFAULT_CORPUS}\`), render mode (\`${DEFAULT_RENDER_MODE}\`), and palette (\`${DEFAULT_FINGER_PALETTE}\`).`,
        ),
      );
      return;
    }

    let positional: string[];
    try {
      ({ positional } = parseCommandArgs(trimmed, {}));
    } catch (error) {
      if (error instanceof FlagParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    if (positional.length === 0) {
      await replyUsage({ message, args }, configCommand);
      return;
    }

    const section = positional[0]!.toLowerCase();

    if (section === "render") {
      if (positional.length === 1) {
        const renderMode = await resolveRenderMode(userId);
        await replyEmbed(
          message,
          infoEmbed(
            "Render mode",
            [
              `**Current mode:** \`${renderMode}\``,
              "",
              "`fingermap` — color keys by finger assignment",
              "`heatmap` — color keys by character frequency in your corpus",
              "",
              `Set with \`${PREFIX}config render fingermap\` or \`${PREFIX}config render heatmap\`.`,
            ].join("\n"),
          ),
        );
        return;
      }

      if (positional.length !== 2) {
        await replyUsage({ message, args }, configCommand);
        return;
      }

      const renderMode = parseRenderMode(positional[1]!);
      if (!renderMode) {
        await replyEmbed(
          message,
          errorEmbed(
            `Unknown render mode \`${positional[1]}\`. Use \`fingermap\` or \`heatmap\`.`,
          ),
        );
        return;
      }

      await setUserRenderMode(userId, renderMode);
      await replyEmbed(
        message,
        infoEmbed(
          "Render mode updated",
          renderMode === "heatmap"
            ? `Layout images will now use a corpus heatmap. Your corpus setting (\`${await resolveCorpus(userId)}\`) controls the frequencies.`
            : "Layout images will now use finger colors.",
        ),
      );
      return;
    }

    if (section === "palette") {
      if (positional.length === 1) {
        const fingermapPalette = await resolveFingermapPalette(userId);
        const options = FINGER_PALETTE_IDS.map(
          (id) => `- \`${id}\` — ${FINGER_PALETTES[id].label}`,
        ).join("\n");

        await replyEmbed(
          message,
          infoEmbed(
            "Palette",
            [
              `**Current palette:** \`${fingermapPalette}\` (${FINGER_PALETTES[fingermapPalette].label})`,
              "",
              options,
              "",
              `Set with \`${PREFIX}config palette <name>\`.`,
            ].join("\n"),
          ),
        );
        return;
      }

      if (positional.length !== 2) {
        await replyUsage({ message, args }, configCommand);
        return;
      }

      const fingermapPalette = parseFingermapPalette(positional[1]!);
      if (!fingermapPalette) {
        await replyEmbed(
          message,
          errorEmbed(
            `Unknown palette \`${positional[1]}\`. Use ${FINGER_PALETTE_IDS.map((id) => `\`${id}\``).join(" or ")}.`,
          ),
        );
        return;
      }

      await setUserFingermapPalette(userId, fingermapPalette);
      await replyEmbed(
        message,
        infoEmbed(
          "Palette updated",
          `Layout images will now use the **${FINGER_PALETTES[fingermapPalette].label}** finger colors.`,
        ),
      );
      return;
    }

    if (section !== "corpus") {
      await replyUsage({ message, args }, configCommand);
      return;
    }

    if (positional.length === 1) {
      const [corpora, effectiveCorpus, userIsAdmin] = await Promise.all([
        listCorpora(),
        resolveCorpus(userId),
        isAdmin(userId),
      ]);

      const corpusFooter = userIsAdmin
        ? `Need another corpus? Use \`${PREFIX}debug corpus get <name>\`.`
        : "Need another corpus? Ask a server admin to download it.";

      await replyEmbed(
        message,
        infoEmbed(
          "Corpus",
          [
            `**Your corpus:** \`${effectiveCorpus}\``,
            "",
            formatCorpusList("Downloaded", corpora.downloaded),
            "",
            `Set yours with \`${PREFIX}config corpus <name>\`.`,
            corpusFooter,
          ].join("\n"),
        ),
      );
      return;
    }

    if (positional.length !== 2) {
      await replyUsage({ message, args }, configCommand);
      return;
    }

    const corpus = positional[1]!;

    try {
      const resolved = await resolveDownloadedCorpus(corpus);
      await setUserCorpus(userId, resolved);

      await replyEmbed(
        message,
        infoEmbed(
          "Corpus updated",
          `Your default corpus is now \`${resolved}\`.\n\nUse \`--corpus\` on a command to override it once.`,
        ),
      );
    } catch (error) {
      if (error instanceof CorpusError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }
  },
};
