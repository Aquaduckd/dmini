import { PREFIX } from "../command/constants.js";
import { FlagParseError, parseCommandArgs } from "../command/flags.js";
import { replyUsage } from "../command/format.js";
import type { Command, CommandContext } from "../command/types.js";
import { resolveCorpus } from "../config/user.js";
import {
  errorEmbed,
  fitsInCodeBlock,
  infoEmbed,
  replyEmbed,
  textCodeBlock,
} from "../discord/embeds.js";
import { replyLoggedError } from "../discord/errors.js";
import { CorpusError } from "../mana2/corpus.js";
import { Mana2Error } from "../mana2/cli.js";
import {
  columnFreqSections,
  exactFreqSections,
  formatFreqText,
  FreqError,
  loadCorpusNgrams,
  permsFreqSections,
  type FreqSection,
} from "../mana2/freq.js";

async function executeFreqLookupCommand(
  { message, args }: CommandContext,
  command: Command,
  options: {
    title: string;
    buildSections: (ngrams: string[]) => FreqSection[];
  },
): Promise<void> {
  let ngrams: string[] = [];
  let corpusFlag: string | undefined;

  try {
    const { positional, flags } = parseCommandArgs(args, {
      corpus: true,
    });

    ngrams = positional;
    corpusFlag = flags.corpus;

    if (ngrams.length === 0) {
      await replyUsage({ message, args }, command);
      return;
    }
  } catch (error) {
    if (error instanceof FlagParseError) {
      await replyEmbed(message, errorEmbed(error.message));
      return;
    }
    throw error;
  }

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
    const data = await loadCorpusNgrams(corpus);
    const sections = options.buildSections(ngrams);
    const text = formatFreqText(corpus, data, sections);

    if (!fitsInCodeBlock(text)) {
      await replyEmbed(
        message,
        errorEmbed("Output is too long for Discord. Try fewer or shorter arguments."),
      );
      return;
    }

    await replyEmbed(
      message,
      infoEmbed(options.title, textCodeBlock(text)),
    );
  } catch (error) {
    if (error instanceof CorpusError || error instanceof FreqError) {
      await replyEmbed(message, errorEmbed(error.message));
      return;
    }

    if (error instanceof Mana2Error) {
      await replyLoggedError(
        message,
        "Failed to look up ngram frequencies:",
        error,
        "Failed to look up ngram frequencies",
      );
      return;
    }

    await replyLoggedError(
      message,
      "Failed to look up ngram frequencies:",
      error,
      "Failed to look up ngram frequencies",
    );
  }
}

async function executeFreqCommand(
  context: CommandContext,
  command: Command,
  mode: "exact" | "perms",
): Promise<void> {
  await executeFreqLookupCommand(context, command, {
    title:
      mode === "exact"
        ? "Ngram frequencies"
        : "Ngram permutation frequencies",
    buildSections:
      mode === "exact" ? exactFreqSections : permsFreqSections,
  });
}

export const freqCommand: Command = {
  name: "freq",
  description: "Show corpus frequency for exact ngrams",
  usage: `${PREFIX}freq <ngram> [ngram...] [--corpus NAME]`,
  notes:
    "Accepts monograms, bigrams, trigrams, and skipgrams. Use `_` in the middle for skipgrams, e.g. `a_b`.",
  examples: [
    `${PREFIX}freq th`,
    `${PREFIX}freq th he the`,
    `${PREFIX}freq a_b st`,
    `${PREFIX}freq th --corpus reddit`,
  ],
  async execute(context) {
    await executeFreqCommand(context, freqCommand, "exact");
  },
};

export const freqsCommand: Command = {
  name: "freqs",
  description: "Show combined corpus frequency for all permutations of each ngram",
  usage: `${PREFIX}freqs <ngram> [ngram...] [--corpus NAME]`,
  notes:
    "Like `freq`, but expands each argument to all permutations (skipgrams also include the reverse). Shows a combined total first.",
  examples: [
    `${PREFIX}freqs th`,
    `${PREFIX}freqs th st`,
    `${PREFIX}freqs a_b`,
    `${PREFIX}freqs th --corpus reddit`,
  ],
  async execute(context) {
    await executeFreqCommand(context, freqsCommand, "perms");
  },
};

export const columnCommand: Command = {
  name: "column",
  description: "Show combined frequencies for all pairs within each character set",
  usage: `${PREFIX}column <chars> [chars...] [--corpus NAME]`,
  notes:
    "Runs `freqs` on all bigram and skipgram pairs from each argument's characters, grouped per argument.",
  examples: [
    `${PREFIX}column etao`,
    `${PREFIX}column th st`,
    `${PREFIX}column etao --corpus reddit`,
  ],
  async execute(context) {
    await executeFreqLookupCommand(context, columnCommand, {
      title: "Column frequencies",
      buildSections: columnFreqSections,
    });
  },
};
