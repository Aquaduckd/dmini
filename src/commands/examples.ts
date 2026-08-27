import { fetchLayoutDoc, LayoutApiError, LayoutNotFoundError } from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import { resolveCorpus } from "../config/user.js";
import {
  layoutNotAnalyzableMessage,
  missingAnalysisCharacters,
} from "../layout/types.js";
import {
  errorEmbed,
  fitsInCodeBlock,
  infoEmbed,
  replyEmbed,
  textCodeBlock,
} from "../discord/embeds.js";
import { Mana2Error } from "../mana2/cli.js";
import { CorpusError } from "../mana2/corpus.js";
import {
  clampExampleLimit,
  clampExamplePage,
  DEFAULT_EXAMPLE_LIMIT,
  EXAMPLE_STATS,
  fetchStatExamples,
  formatExamplesText,
  MAX_EXAMPLE_LIMIT,
  paginateExamples,
  resolveStatId,
} from "../mana2/examples.js";

interface ParsedExamplesArgs {
  layout: string;
  stat: string;
  limit: number;
  page: number;
  corpus?: string;
}

function parseExamplesArgs(args: string): ParsedExamplesArgs | "list" | null {
  const trimmed = args.trim();
  if (!trimmed) return null;

  if (/^stats$/i.test(trimmed)) {
    return "list";
  }

  try {
    const { positional, flags } = parseCommandArgs(trimmed, {
      corpus: true,
      limit: true,
      page: true,
    });

    if (positional.length !== 2) return null;

    return {
      stat: positional[0]!,
      layout: positional[1]!,
      limit: flags.limit ?? DEFAULT_EXAMPLE_LIMIT,
      page: flags.page ?? 1,
      corpus: flags.corpus,
    };
  } catch (error) {
    if (error instanceof FlagParseError) throw error;
    return null;
  }
}

function examplesStatsEmbed() {
  const stats = EXAMPLE_STATS.map((stat) => `\`${stat}\``).join(", ");
  return infoEmbed(
    "Example stats",
    `Use \`${PREFIX}examples <stat> <layout> [--limit N] [--page N] [--corpus NAME]\`\n\n` +
      `**Stats:** ${stats}\n\n` +
      `**Flags:** \`--limit\` / \`-l\` (1–${MAX_EXAMPLE_LIMIT}, default ${DEFAULT_EXAMPLE_LIMIT}), ` +
      `\`--page\` / \`-p\` (default 1), \`--corpus\` / \`-c\``,
  );
}

export const examplesCommand: Command = {
  name: "examples",
  description: "Show corpus examples for a layout stat",
  usage: `${PREFIX}examples <stat> <layout> [--limit N] [--page N] [--corpus NAME]`,
  group: "Analysis",
  aliases: ["ex"],
  examples: [
    `${PREFIX}examples sfb qwerty`,
    `${PREFIX}examples roll gallium --limit 20`,
    `${PREFIX}examples sfb qwerty --page 2`,
    `${PREFIX}examples sfb qwerty -l 10 -p 2 --corpus reddit`,
    `${PREFIX}examples stats`,
  ],
  async execute({ message, args }) {
    let parsed: ParsedExamplesArgs | "list" | null;

    try {
      parsed = parseExamplesArgs(args);
    } catch (error) {
      if (error instanceof FlagParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    if (parsed === "list") {
      await replyEmbed(message, examplesStatsEmbed());
      return;
    }

    if (!parsed) {
      await replyUsage({ message, args }, examplesCommand);
      return;
    }

    const limit = clampExampleLimit(parsed.limit);
    const page = clampExamplePage(parsed.page);
    const stat = resolveStatId(parsed.stat);
    let corpus: string;

    try {
      corpus = await resolveCorpus(message.author.id, parsed.corpus);
    } catch (error) {
      if (error instanceof CorpusError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    try {
      const layout = await fetchLayoutDoc(parsed.layout);

      const missing = missingAnalysisCharacters(layout);
      if (missing.length > 0) {
        await replyEmbed(
          message,
          errorEmbed(layoutNotAnalyzableMessage(layout.name, missing)),
        );
        return;
      }

      const examples = await fetchStatExamples(layout, stat, { corpus });

      if (examples.length === 0) {
        await replyEmbed(
          message,
          errorEmbed(`No examples found for \`${stat}\` on \`${layout.name}\`.`),
        );
        return;
      }

      const result = paginateExamples(layout.name, stat, examples, limit, page);
      let text = formatExamplesText(result);

      if (!fitsInCodeBlock(text)) {
        const reduced = paginateExamples(
          layout.name,
          stat,
          examples,
          Math.min(limit, 20),
          page,
        );
        text = formatExamplesText(reduced);

        if (!fitsInCodeBlock(text)) {
          await replyEmbed(
            message,
            errorEmbed(
              "Example output is too long for Discord. Try a smaller limit or page.",
            ),
          );
          return;
        }
      }

      await replyEmbed(
        message,
        infoEmbed(`${stat} · ${layout.name}`, textCodeBlock(text)).setFooter({
          text: `Page ${result.page}/${result.pageCount} · ${result.limit} per page · ${result.total} total · ${corpus}`,
        }),
      );
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

      if (error instanceof Mana2Error) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }

      console.error("Failed to fetch stat examples:", error);
      await replyEmbed(message, errorEmbed("Failed to fetch stat examples."));
    }
  },
};
