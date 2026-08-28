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
import { replyLoggedError } from "../discord/errors.js";

export const setmagicCommand: Command = {
  name: "setmagic",
  description: "Set, append, or clear magic rules on one of your layouts",
  usage: `${PREFIX}setmagic <layout> [--append|--clear]`,
  notes: [
    "Include rules in a fenced code block, one per line:",
    "```",
    "a* aa repeat",
    "g* gs magic",
    "```",
    "Format: inputs output [type]. Types: repeat, magic, adaptive, chiral.",
    "Without --append, existing rules are replaced. With --append, rules merge by inputs.",
    "Use --clear to remove all magic rules without a code block.",
  ].join("\n"),
  examples: [
    `${PREFIX}setmagic opal`,
    `${PREFIX}setmagic opal --append`,
    `${PREFIX}setmagic opal --clear`,
  ],
  async execute({ message }) {
    const input = parseCommandWithOptionalCodeBlock(
      message.content,
      PREFIX,
      "setmagic",
    );

    if (!input) {
      await replyUsage({ message, args: "" }, setmagicCommand);
      return;
    }

    let layoutName = "";
    let append = false;
    let clear = false;

    try {
      const { positional, flags } = parseCommandArgs(input.args, {
        append: true,
        clear: true,
      });
      layoutName = positional[0]?.trim() ?? "";
      append = flags.append ?? false;
      clear = flags.clear ?? false;

      if (!layoutName || positional.length > 1) {
        await replyUsage({ message, args: input.args }, setmagicCommand);
        return;
      }
    } catch (error) {
      if (error instanceof FlagParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    if (append && clear) {
      await replyEmbed(
        message,
        errorEmbed("Use only one of `--append` or `--clear`."),
      );
      return;
    }

    if (clear && input.codeBlock) {
      await replyEmbed(
        message,
        errorEmbed("Use either a code block or `--clear`, not both."),
      );
      return;
    }

    if (!clear && !input.codeBlock) {
      await replyEmbed(
        message,
        errorEmbed("Missing code block.", "Usage").setDescription(
          `Usage: \`${setmagicCommand.usage}\`\nSee \`${PREFIX}help setmagic\` for the rule format.`,
        ),
      );
      return;
    }

    try {
      const layout = await fetchLayoutDoc(layoutName);

      if (!layoutOwnedByUser(layout, message.author.id)) {
        await replyEmbed(
          message,
          errorEmbed(`You don't own any layout named \`${layoutName}\`.`),
        );
        return;
      }

      if (clear) {
        if (!layout.magic?.length) {
          await replyEmbed(
            message,
            infoEmbed(
              "No magic rules",
              `\`${layout.name}\` already has no magic rules.`,
            ),
          );
          return;
        }

        layout.magic = [];
        await updateLayout(layout);

        await replyEmbed(
          message,
          infoEmbed(
            "Magic rules cleared",
            `Removed all magic rules from \`${layout.name}\`.`,
          ),
        );
        return;
      }

      const rules = parseMagicRules(input.codeBlock!);
      if (rules.length === 0) {
        await replyEmbed(message, errorEmbed("No magic rules to set."));
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

      await replyLoggedError(
        message,
        "Failed to update magic rules:",
        error,
        "Failed to update magic rules",
      );
    }
  },
};
