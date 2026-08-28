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
  ComboParseError,
  formatCombosText,
  parseCombos,
} from "../layout/combos.js";
import { layoutOwnedByUser } from "../layout/types.js";
import {
  errorEmbed,
  fitsInCodeBlock,
  infoEmbed,
  replyEmbed,
  textCodeBlock,
} from "../discord/embeds.js";
import { replyLoggedError } from "../discord/errors.js";

export const setcombosCommand: Command = {
  name: "setcombos",
  description: "Set combos on one of your layouts",
  usage: `${PREFIX}setcombos <layout> [--clear]`,
  notes: [
    "Include combos in a fenced code block, one per line:",
    "```",
    "th !",
    "ea @ symbols",
    "```",
    "Format: inputs output [layer]. Omit layer for the base layer.",
    "Use --clear to remove all combos without a code block.",
  ].join("\n"),
  examples: [
    `${PREFIX}setcombos opal`,
    `${PREFIX}setcombos opal --clear`,
  ],
  async execute({ message }) {
    const input = parseCommandWithOptionalCodeBlock(
      message.content,
      PREFIX,
      "setcombos",
    );

    if (!input) {
      await replyUsage({ message, args: "" }, setcombosCommand);
      return;
    }

    let layoutName = "";
    let clear = false;

    try {
      const { positional, flags } = parseCommandArgs(input.args, {
        clear: true,
      });
      layoutName = positional[0]?.trim() ?? "";
      clear = flags.clear ?? false;

      if (!layoutName || positional.length > 1) {
        await replyUsage({ message, args: input.args }, setcombosCommand);
        return;
      }
    } catch (error) {
      if (error instanceof FlagParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
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
          `Usage: \`${setcombosCommand.usage}\`\nSee \`${PREFIX}help setcombos\` for the combo format.`,
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
        layout.combos = [];
      } else {
        const combos = parseCombos(input.codeBlock!, layout);
        if (combos.length === 0) {
          await replyEmbed(message, errorEmbed("No combos to set."));
          return;
        }
        layout.combos = combos;
      }

      await updateLayout(layout);

      if (clear) {
        await replyEmbed(
          message,
          infoEmbed(
            "Combos cleared",
            `Removed all combos from \`${layout.name}\`.`,
          ),
        );
        return;
      }

      const formatted = formatCombosText(layout.combos);
      const summary = `Set combos on \`${layout.name}\` (${layout.combos!.length} combo${layout.combos!.length === 1 ? "" : "s"} total).`;

      if (fitsInCodeBlock(formatted)) {
        await replyEmbed(
          message,
          infoEmbed(
            "Combos updated",
            `${summary}\n${textCodeBlock(formatted)}`,
          ),
        );
        return;
      }

      await replyEmbed(
        message,
        infoEmbed(
          "Combos updated",
          `${summary}\nUse \`${PREFIX}combos ${layout.name}\` to view all combos.`,
        ),
      );
    } catch (error) {
      if (error instanceof LayoutNotFoundError) {
        await replyEmbed(message, errorEmbed(error.formatMessage()));
        return;
      }

      if (error instanceof ComboParseError) {
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
        "Failed to update combos:",
        error,
        "Failed to update combos",
      );
    }
  },
};
