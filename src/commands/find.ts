import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import { resolveCorpus } from "../config/user.js";
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
  clampFindLimit,
  DEFAULT_FIND_LIMIT,
  formatCorpusSearchText,
  loadCorpusWords,
  MAX_FIND_LIMIT,
  searchCorpusWords,
} from "../mana2/corpusWords.js";

export const findCommand: Command = {
  name: "find",
  description: "Find corpus words matching a pattern",
  usage: `${PREFIX}find <pattern> [--limit N] [--corpus NAME]`,
  notes: "Pattern is a JavaScript regular expression. Plain alphanumeric patterns use substring search.",
  examples: [
    `${PREFIX}find th`,
    `${PREFIX}find ^the`,
    `${PREFIX}find ing$`,
    `${PREFIX}find t.e --limit 20`,
  ],
  async execute({ message, args }) {
    let pattern = "";
    let limit = DEFAULT_FIND_LIMIT;
    let corpusFlag: string | undefined;

    try {
      const { positional, flags } = parseCommandArgs(args, {
        corpus: true,
        limit: true,
      });

      pattern = positional.join(" ").trim();
      if (!pattern) {
        await replyUsage({ message, args }, findCommand);
        return;
      }

      limit = flags.limit ?? DEFAULT_FIND_LIMIT;
      corpusFlag = flags.corpus;
    } catch (error) {
      if (error instanceof FlagParseError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    limit = clampFindLimit(limit);

    let corpus: string;
    try {
      corpus = await resolveCorpus(message.author.id, corpusFlag);
    } catch (error) {
      if (error instanceof CorpusError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }
      throw error;
    }

    try {
      const words = await loadCorpusWords(corpus);
      const result = searchCorpusWords(words, pattern, limit);

      if (result.matches.length === 0) {
        await replyEmbed(
          message,
          errorEmbed(`\`${pattern}\` does not appear anywhere in corpus \`${corpus}\`.`),
        );
        return;
      }

      const text = formatCorpusSearchText(pattern, corpus, result);

      if (!fitsInCodeBlock(text)) {
        await replyEmbed(
          message,
          errorEmbed(
            "Output is too long for Discord. Try a smaller `--limit` value.",
          ),
        );
        return;
      }

      await replyEmbed(
        message,
        infoEmbed("Corpus matches", textCodeBlock(text)).setFooter({
          text: `Top ${result.matches.length} · limit ${limit} (max ${MAX_FIND_LIMIT}) · ${corpus}`,
        }),
      );
    } catch (error) {
      if (error instanceof CorpusError || error instanceof Mana2Error) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }

      if (error instanceof SyntaxError) {
        await replyEmbed(message, errorEmbed(`Invalid pattern: ${error.message}`));
        return;
      }

      console.error("Failed to search corpus:", error);
      await replyEmbed(message, errorEmbed("Failed to search corpus."));
    }
  },
};
