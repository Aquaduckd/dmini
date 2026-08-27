import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import {
  createLayout,
  formatWriteApiError,
  LayoutApiError,
} from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import { DEFAULT_BOARD, formatBoardList, parseBoard } from "../layout/board.js";
import { MatrixParseError, parseLayoutMatrix } from "../layout/matrix.js";
import {
  LayoutNameError,
  normalizeLayoutName,
  validateLayoutName,
} from "../layout/name.js";
import {
  isStaggeredBoard,
  layoutToRenderKeys,
  missingAnalysisCharacters,
} from "../layout/types.js";
import { resolveFingermapPalette } from "../config/user.js";
import { Colors, errorEmbed, replyEmbed } from "../discord/embeds.js";
import { replyLoggedError } from "../discord/errors.js";
import { renderKeyboardPng } from "../render/keyboard.js";

function parseAddInput(
  content: string,
  prefix: string,
): { args: string; matrix: string } | null {
  const fenceIndex = content.indexOf("```");
  if (fenceIndex === -1) {
    return null;
  }

  const header = content.slice(0, fenceIndex).trimEnd();
  if (!header.startsWith(prefix)) {
    return null;
  }

  const body = header.slice(prefix.length).trim();
  const space = body.indexOf(" ");
  if (space === -1 || body.slice(0, space).toLowerCase() !== "add") {
    return null;
  }

  const afterFence = content.slice(fenceIndex + 3);
  const closingIndex = afterFence.indexOf("```");
  if (closingIndex === -1) {
    return null;
  }

  return {
    args: body.slice(space + 1).trim(),
    matrix: afterFence.slice(0, closingIndex).trim(),
  };
}

export const addCommand: Command = {
  name: "add",
  description: "Add a new keyboard layout to the catalog",
  usage: `${PREFIX}add <name> [--board <type>]`,
  notes: [
    "Include the key matrix in a fenced code block:",
    "```",
    "q w e r t",
    "a s d f g",
    "z x c v b",
    "```",
    "Use ~ for empty keys. Rows must not be indented.",
    "Board defaults to ortho when omitted.",
  ].join("\n"),
  examples: [
    `${PREFIX}add mylayout`,
    `${PREFIX}add mylayout --board stagger`,
  ],
  async execute({ message, args }) {
    const input = parseAddInput(message.content, PREFIX);
    if (!input) {
      await replyEmbed(
        message,
        errorEmbed(
          "Missing layout matrix.",
          "Usage",
        ).setDescription(
          [
            `Usage: \`${PREFIX}add <name> [--board ${formatBoardList()}]\``,
            "Board defaults to `ortho` when omitted.",
            "Include the key matrix in a fenced code block:",
            "```",
            "q w e r t",
            "a s d f g",
            "z x c v b",
            "```",
            "",
            "Use `~` for empty keys. Rows must not be indented.",
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

    let board = DEFAULT_BOARD;
    if (boardFlag) {
      const parsed = parseBoard(boardFlag);
      if (!parsed) {
        await replyEmbed(
          message,
          errorEmbed(
            `Unknown board \`${boardFlag}\`. Choose one of: ${formatBoardList()}.`,
          ),
        );
        return;
      }
      board = parsed;
    }

    if (positional.length === 0) {
      await replyUsage({ message, args: input.args }, addCommand);
      return;
    }

    const name = normalizeLayoutName(positional);

    try {
      validateLayoutName(name);
    } catch (error) {
      if (error instanceof LayoutNameError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    let keys;

    try {
      ({ keys } = parseLayoutMatrix(input.matrix, board));
    } catch (error) {
      if (error instanceof MatrixParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    const layout = {
      name,
      board,
      user: message.author.id,
      keys,
    };

    try {
      await createLayout(layout);
    } catch (error) {
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
        "Failed to create layout:",
        error,
        "Failed to create layout",
      );
      return;
    }

    const missing = missingAnalysisCharacters(layout);
    const renderKeys = layoutToRenderKeys(layout);
    const fingermapPalette = await resolveFingermapPalette(message.author.id);
    const png = renderKeyboardPng(renderKeys, isStaggeredBoard(board), {
      mode: "fingermap",
      fingermapPalette,
    });
    const filename = `${name}.png`;
    const attachment = new AttachmentBuilder(png, { name: filename });
    const embed = new EmbedBuilder()
      .setColor(Colors.primary)
      .setTitle(`Added ${name}`)
      .setAuthor({ name: message.author.username })
      .setImage(`attachment://${filename}`)
      .setDescription(
        missing.length === 0
          ? "Layout created and ready to analyze."
          : `Layout created. Missing for analysis: ${missing.map((character) => `\`${character}\``).join(", ")}.`,
      )
      .setFooter({ text: `Board: ${board}` });

    await replyEmbed(message, embed, { files: [attachment] });
  },
};
