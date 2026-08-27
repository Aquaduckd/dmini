import {
  fetchLayoutDoc,
  formatWriteApiError,
  LayoutApiError,
  LayoutNotFoundError,
  updateLayout,
} from "../api/layouts.js";
import { parseCommandWithOptionalCodeBlock } from "../command/codeblock.js";
import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import {
  formatMagicRulesText,
  MagicParseError,
  mergeMagicRules,
  parseMagicRules,
} from "../layout/magic.js";
import { layoutOwnedByUser } from "../layout/types.js";
import {
  errorEmbed,
  fitsInCodeBlock,
  infoEmbed,
  replyEmbed,
  textCodeBlock,
} from "../discord/embeds.js";

export const addmagicCommand: Command = {
  name: "addmagic",
  description: "Set or append magic rules on one of your layouts",
  usage: `${PREFIX}addmagic <layout> [--append]`,
  notes: [
    "Include rules in a fenced code block, one per line:",
    "```",
    "a* aa repeat",
    "g* gs magic",
    "```",
    "Format: inputs output [type]. Types: repeat, magic, adaptive, chiral.",
    "Without --append, existing rules are replaced. With --append, rules merge by inputs.",
  ].join("\n"),
  examples: [
    `${PREFIX}addmagic opal`,
    `${PREFIX}addmagic opal --append`,
  ],
  async execute({ message }) {
    const input = parseCommandWithOptionalCodeBlock(
      message.content,
      "addmagic",
    );

    if (!input?.codeBlock) {
      await replyEmbed(
        message,
        errorEmbed("Missing code block.", "Usage").setDescription(
          `Usage: \`${addmagicCommand.usage}\`\nSee \`${PREFIX}help addmagic\` for the rule format.`,
        ),
      );
      return;
    }

    let layoutName = "";
    let append = false;

    try {
      const { positional, flags } = parseCommandArgs(input.args, {
        append: true,
      });
      layoutName = positional[0]?.trim() ?? "";
      append = flags.append ?? false;

      if (!layoutName || positional.length > 1) {
        await replyUsage({ message, args: input.args }, addmagicCommand);
        return;
      }
    } catch (error) {
      if (error instanceof FlagParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    try {
      const rules = parseMagicRules(input.codeBlock);
      if (rules.length === 0) {
        await replyEmbed(message, errorEmbed("No magic rules to add."));
        return;
      }

      const layout = await fetchLayoutDoc(layoutName);

      if (!layoutOwnedByUser(layout, message.author.id)) {
        await replyEmbed(
          message,
          errorEmbed(`You don't own any layout named \`${layoutName}\`.`),
        );
        return;
      }

      layout.magic = append
        ? mergeMagicRules(layout.magic ?? [], rules)
        : rules;

      await updateLayout(layout);

      const action = append ? "Appended to" : "Set magic on";
      const formatted = formatMagicRulesText(layout.magic);
      const summary = `${action} \`${layout.name}\` (${layout.magic.length} rule${layout.magic.length === 1 ? "" : "s"} total).`;

      if (fitsInCodeBlock(formatted)) {
        await replyEmbed(
          message,
          infoEmbed("Magic rules updated", `${summary}\n${textCodeBlock(formatted)}`),
        );
        return;
      }

      await replyEmbed(
        message,
        infoEmbed(
          "Magic rules updated",
          `${summary}\nUse \`${PREFIX}magic ${layout.name}\` to view all rules.`,
        ),
      );
    } catch (error) {
      if (error instanceof LayoutNotFoundError) {
        await replyEmbed(message, errorEmbed(error.formatMessage()));
        return;
      }

      if (error instanceof MagicParseError) {
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

      console.error("Failed to update magic rules:", error);
      await replyEmbed(message, errorEmbed("Failed to update magic rules."));
    }
  },
};
