import { AttachmentBuilder, EmbedBuilder } from "discord.js";
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
import { resolveFingermapPalette } from "../config/user.js";
import { Colors, errorEmbed, replyEmbed } from "../discord/embeds.js";
import {
  DEFAULT_BOARD,
  formatBoardList,
  parseBoard,
} from "../layout/board.js";
import {
  applyDefaultBoard,
  applyFingerGrid,
  FingermapParseError,
  parseFingerGrid,
} from "../layout/fingermap.js";
import {
  isStaggeredBoard,
  layoutOwnedByUser,
  layoutToRenderKeys,
} from "../layout/types.js";
import { renderKeyboardPng } from "../render/keyboard.js";

export const setboardCommand: Command = {
  name: "setboard",
  description: "Set a layout's board type and finger assignments",
  usage: `${PREFIX}setboard <name> [--board <type>]`,
  notes: [
    "Apply a default finger map with --board, or pass a custom grid in a fenced code block:",
    "```",
    "0 1 2 3 3 6 6 7 8 9",
    "0 1 2 3 3 6 6 7 8 9",
    "0 1 2 3 3 6 6 7 8 9",
    "```",
    "Digits: 0=LP 1=LR 2=LM 3=LI 4=LT 5=RT 6=RI 7=RM 8=RR 9=RP",
    "Grid rows and columns must match the layout's shape.",
  ].join("\n"),
  examples: [
    `${PREFIX}setboard mylayout --board ortho`,
    `${PREFIX}setboard mylayout`,
  ],
  async execute({ message, args }) {
    const input = parseCommandWithOptionalCodeBlock(
      message.content,
      PREFIX,
      "setboard",
    );
    if (!input) {
      await replyEmbed(
        message,
        errorEmbed(
          "Missing layout name or finger grid.",
          "Usage",
        ).setDescription(
          [
            `Usage: \`${PREFIX}setboard <name> [--board ${formatBoardList()}]\``,
            "",
            "Apply a default finger map with `--board`, or pass a custom grid in a code block:",
            "```",
            "0 1 2 3 3 6 6 7 8 9",
            "0 1 2 3 3 6 6 7 8 9",
            "0 1 2 3 3 6 6 7 8 9",
            "```",
            "",
            "Digits: 0=LP 1=LR 2=LM 3=LI 4=LT 5=RT 6=RI 7=RM 8=RR 9=RP",
            "Grid rows and columns must match the layout's shape.",
          ].join("\n"),
        ),
      );
      return;
    }

    let positional: string[];
    let boardFlag: string | undefined;

    try {
      ({
        positional,
        flags: { board: boardFlag },
      } = parseCommandArgs(input.args || args, { board: true }));
    } catch (error) {
      if (error instanceof FlagParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    if (positional.length === 0) {
      await replyUsage({ message, args: input.args ?? args }, setboardCommand);
      return;
    }

    const name = positional.join("-").toLowerCase();
    const hasCodeBlock = Boolean(input.codeBlock?.trim());
    const parsedBoard = boardFlag ? parseBoard(boardFlag) : null;

    if (boardFlag && !parsedBoard) {
      await replyEmbed(
        message,
        errorEmbed(
          `Unknown board \`${boardFlag}\`. Choose one of: ${formatBoardList()}.`,
        ),
      );
      return;
    }

    if (!hasCodeBlock && !parsedBoard) {
      await replyEmbed(
        message,
        errorEmbed(
          "Provide `--board` for a default finger map, or include a finger grid in a code block.",
        ),
      );
      return;
    }

    try {
      const layout = await fetchLayoutDoc(name);

      if (!layoutOwnedByUser(layout, message.author.id)) {
        await replyEmbed(
          message,
          errorEmbed(`You don't own any layout named \`${name}\`.`),
        );
        return;
      }

      if (hasCodeBlock) {
        const grid = parseFingerGrid(input.codeBlock!);
        applyFingerGrid(layout, grid);
        if (parsedBoard) {
          layout.board = parsedBoard;
        }
      } else {
        applyDefaultBoard(layout, parsedBoard ?? DEFAULT_BOARD);
      }

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
        .setFooter({ text: `Board: ${layout.board}` });

      await replyEmbed(message, embed, { files: [attachment] });
    } catch (error) {
      if (error instanceof LayoutNotFoundError) {
        await replyEmbed(message, errorEmbed(error.formatMessage()));
        return;
      }

      if (error instanceof FingermapParseError) {
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

      console.error("Failed to set board:", error);
      await replyEmbed(message, errorEmbed("Failed to update layout."));
    }
  },
};
