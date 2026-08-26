import { AttachmentBuilder, type Message } from "discord.js";
import { fetchLayout, fetchLayoutDoc, LayoutApiError, LayoutNotFoundError } from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import type { Command } from "../command/types.js";
import { BOT_DEFAULT_CORPUS } from "../config/user.js";
import {
  errorEmbed,
  fitsInCodeBlock,
  infoEmbed,
  layoutJsonEmbed,
  replyEmbed,
} from "../discord/embeds.js";
import { analyzeLayoutRaw, Mana2Error } from "../mana2/analyze.js";
import {
  ANALYZER_VERSION,
  clearAnalysisCache,
  getCacheStatus,
  warmAnalysisCache,
} from "../mana2/cache.js";
import {
  buildAndSaveCorpusPercentileCutoffs,
  PERCENTILE_BUCKET_COUNT,
} from "../mana2/percentiles.js";
import {
  layoutNotAnalyzableMessage,
  missingAnalysisCharacters,
} from "../layout/types.js";
import { CorpusError, downloadAllCorpora, downloadCorpus, listCorpora } from "../mana2/corpus.js";

interface DebugSubcommand {
  description: string;
  usage: string;
  examples: string[];
  execute(message: Message, args: string): Promise<void>;
}

async function handleLayoutJson(message: Message, name: string): Promise<void> {
  if (!name) {
    await replyEmbed(
      message,
      errorEmbed("Missing layout name.", "Usage")
        .setDescription(`Usage: \`${PREFIX}debug layout <name>\``),
    );
    return;
  }

  try {
    const raw = await fetchLayout(name);
    const formatted = JSON.stringify(JSON.parse(raw), null, 2);
    const filename = `${name.toLowerCase()}.json`;

    if (fitsInCodeBlock(formatted)) {
      await replyEmbed(message, layoutJsonEmbed(name, formatted));
      return;
    }

    const attachment = new AttachmentBuilder(Buffer.from(formatted), {
      name: filename,
    });
    await replyEmbed(message, layoutJsonEmbed(name, "Layout JSON attached."), {
      files: [attachment],
    });
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

    console.error("Failed to fetch layout:", error);
    await replyEmbed(message, errorEmbed("Failed to fetch layout."));
  }
}

async function handleAnalyze(message: Message, name: string): Promise<void> {
  if (!name) {
    await replyEmbed(
      message,
      errorEmbed("Missing layout name.", "Usage")
        .setDescription(`Usage: \`${PREFIX}debug analyze <name>\``),
    );
    return;
  }

  try {
    const layout = await fetchLayoutDoc(name);

    const missing = missingAnalysisCharacters(layout);
    if (missing.length > 0) {
      await replyEmbed(
        message,
        errorEmbed(layoutNotAnalyzableMessage(layout.name, missing)),
      );
      return;
    }

    const raw = await analyzeLayoutRaw(layout);
    const formatted = JSON.stringify(JSON.parse(raw), null, 2);
    const filename = `${name.toLowerCase()}-analysis.json`;

    if (fitsInCodeBlock(formatted)) {
      await replyEmbed(message, layoutJsonEmbed(`${name} analysis`, formatted));
      return;
    }

    const attachment = new AttachmentBuilder(Buffer.from(formatted), {
      name: filename,
    });
    await replyEmbed(
      message,
      layoutJsonEmbed(`${name} analysis`, "Analysis JSON attached."),
      { files: [attachment] },
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

    console.error("Failed to analyze layout:", error);
    await replyEmbed(message, errorEmbed("Failed to analyze layout."));
  }
}

async function handleCorpus(message: Message, args: string): Promise<void> {
  const trimmed = args.trim();

  if (!trimmed) {
    const corpora = await listCorpora();
    const lines = [
      "**Downloaded**",
      ...(corpora.downloaded.length > 0
        ? corpora.downloaded.map((name) => `- \`${name}\``)
        : ["- (none)"]),
      "",
      "**Not downloaded**",
      ...(corpora.available.length > 0
        ? corpora.available.map((name) => `- \`${name}\``)
        : ["- (none)"]),
      "",
      `Download with \`${PREFIX}debug corpus get <name>\` or \`${PREFIX}debug corpus get all\`.`,
    ];

    await replyEmbed(message, infoEmbed("Corpora", lines.join("\n")));
    return;
  }

  const space = trimmed.indexOf(" ");
  const action = trimmed.slice(0, space === -1 ? undefined : space).toLowerCase();
  const name = space === -1 ? "" : trimmed.slice(space + 1).trim();

  if (action !== "get") {
    await replyEmbed(
      message,
      errorEmbed("Usage", "Invalid corpus subcommand").setDescription(
        `Usage: \`${PREFIX}debug corpus\` or \`${PREFIX}debug corpus get <name>\``,
      ),
    );
    return;
  }

  if (!name) {
    await replyEmbed(
      message,
      errorEmbed("Missing corpus name.", "Usage").setDescription(
        `Usage: \`${PREFIX}debug corpus get <name>\` or \`${PREFIX}debug corpus get all\``,
      ),
    );
    return;
  }

  if (name.toLowerCase() === "all") {
    try {
      const result = await downloadAllCorpora();
      const lines = [
        `Downloaded **${result.downloaded.length}** ${result.downloaded.length === 1 ? "corpus" : "corpora"}.`,
      ];

      if (result.downloaded.length > 0) {
        lines.push(
          "",
          result.downloaded.map((corpus) => `- \`${corpus}\``).join("\n"),
        );
      }

      if (result.skipped.length > 0) {
        lines.push(
          "",
          `Already present (${result.skipped.length}): ${result.skipped.map((corpus) => `\`${corpus}\``).join(", ")}`,
        );
      }

      if (result.failed.length > 0) {
        lines.push(
          "",
          "**Failed**",
          ...result.failed.map(
            ({ name: corpus, message }) => `- \`${corpus}\`: ${message}`,
          ),
        );
      }

      await replyEmbed(message, infoEmbed("Corpora downloaded", lines.join("\n")));
    } catch (error) {
      console.error("Failed to download all corpora:", error);
      await replyEmbed(message, errorEmbed("Failed to download corpora."));
    }
    return;
  }

  try {
    const resolved = await downloadCorpus(name);
    await replyEmbed(
      message,
      infoEmbed("Corpus downloaded", `\`${resolved}\` is ready to use.`),
    );
  } catch (error) {
    if (error instanceof CorpusError) {
      await replyEmbed(message, errorEmbed(error.message));
      return;
    }

    console.error("Failed to download corpus:", error);
    await replyEmbed(message, errorEmbed("Failed to download corpus."));
  }
}

async function handleCache(message: Message, args: string): Promise<void> {
  const trimmed = args.trim();
  const space = trimmed.indexOf(" ");
  const action = (space === -1 ? trimmed : trimmed.slice(0, space)).toLowerCase() || "status";
  const actionArgs = space === -1 ? "" : trimmed.slice(space + 1).trim();

  if (action === "status") {
    const status = await getCacheStatus();
    const lines = [
      `Analyzer version: **${ANALYZER_VERSION}**`,
      `Layout cache files: **${status.layoutFiles}**`,
    ];

    if (status.corpora.length > 0) {
      lines.push("", status.corpora.map((corpus) => `- \`${corpus}\``).join("\n"));
    }

    await replyEmbed(message, infoEmbed("Analysis cache", lines.join("\n")));
    return;
  }

  if (action === "clear") {
    await clearAnalysisCache(actionArgs || undefined);
    const scope = actionArgs ? `\`${actionArgs}\`` : "all cached analysis data";
    await replyEmbed(message, infoEmbed("Cache cleared", `Removed ${scope}.`));
    return;
  }

  if (action === "warm") {
    await replyEmbed(
      message,
      infoEmbed(
        "Cache warm started",
        actionArgs
          ? `Computing missing stats for corpus \`${actionArgs}\`…`
          : `Computing missing stats for corpus \`${BOT_DEFAULT_CORPUS}\`…`,
      ),
    );

    try {
      const results = await warmAnalysisCache(
        actionArgs ? { corpus: actionArgs } : {},
      );

      const lines = results.map((result) => {
        const parts = [
          `**${result.corpus}**`,
          `${result.computed} computed`,
          `${result.skipped} skipped`,
        ];
        if (result.failed > 0) {
          parts.push(`${result.failed} failed`);
        }
        return parts.join(" · ");
      });

      if (results.some((result) => result.errors.length > 0)) {
        lines.push("", "**Failures**");
        for (const result of results) {
          for (const error of result.errors.slice(0, 5)) {
            lines.push(`- \`${error.layout}\`: ${error.message}`);
          }
          if (result.errors.length > 5) {
            lines.push(`- …and ${result.errors.length - 5} more`);
          }
        }
      }

      await replyEmbed(message, infoEmbed("Cache warm finished", lines.join("\n")));
    } catch (error) {
      if (error instanceof CorpusError) {
        await replyEmbed(message, errorEmbed(error.message));
        return;
      }

      console.error("Failed to warm analysis cache:", error);
      await replyEmbed(message, errorEmbed("Failed to warm analysis cache."));
    }
    return;
  }

  await replyEmbed(
    message,
    errorEmbed("Usage", "Invalid cache subcommand").setDescription(
      [
        `\`${PREFIX}debug cache\` — show cache status`,
        `\`${PREFIX}debug cache warm [corpus]\` — compute missing stats`,
        `\`${PREFIX}debug cache clear [layout]\` — clear cache entries`,
      ].join("\n"),
    ),
  );
}

async function handlePercentiles(message: Message, args: string): Promise<void> {
  const corpus = args.trim() || BOT_DEFAULT_CORPUS;

  try {
    const { table, filePath } = await buildAndSaveCorpusPercentileCutoffs(corpus);
    const statCount = Object.keys(table.stats).length;

    await replyEmbed(
      message,
      infoEmbed(
        "Percentile cutoffs",
        [
          `Corpus: \`${table.corpus}\``,
          `Layouts: **${table.layout_count}**`,
          `Stats: **${statCount}**`,
          `Buckets per stat: **${PERCENTILE_BUCKET_COUNT}**`,
          `Saved to \`${filePath}\``,
        ].join("\n"),
      ),
    );
  } catch (error) {
    if (error instanceof CorpusError) {
      await replyEmbed(message, errorEmbed(error.message));
      return;
    }

    if (error instanceof Error) {
      await replyEmbed(message, errorEmbed(error.message));
      return;
    }

    console.error("Failed to build percentile cutoffs:", error);
    await replyEmbed(message, errorEmbed("Failed to build percentile cutoffs."));
  }
}

const subcommands: Record<string, DebugSubcommand> = {
  layout: {
    description: "Fetch raw JSON for a layout",
    usage: `${PREFIX}debug layout <name>`,
    examples: [`${PREFIX}debug layout qwerty`, `${PREFIX}debug layout gallium`],
    execute: handleLayoutJson,
  },
  analyze: {
    description: "Run mana2 analysis and return raw JSON stats",
    usage: `${PREFIX}debug analyze <name>`,
    examples: [`${PREFIX}debug analyze qwerty`, `${PREFIX}debug analyze gallium`],
    execute: handleAnalyze,
  },
  corpus: {
    description: "List or download mana2 corpora",
    usage: `${PREFIX}debug corpus [get <name>|get all]`,
    examples: [
      `${PREFIX}debug corpus`,
      `${PREFIX}debug corpus get reddit`,
      `${PREFIX}debug corpus get all`,
    ],
    execute: handleCorpus,
  },
  cache: {
    description: "Inspect or rebuild the on-disk analysis cache",
    usage: `${PREFIX}debug cache [status|warm [corpus]|clear [layout]]`,
    examples: [
      `${PREFIX}debug cache`,
      `${PREFIX}debug cache warm`,
      `${PREFIX}debug cache warm reddit`,
    ],
    execute: handleCache,
  },
  percentiles: {
    description: "Build percentile cutoff tables from cached stats",
    usage: `${PREFIX}debug percentiles [corpus]`,
    examples: [
      `${PREFIX}debug percentiles`,
      `${PREFIX}debug percentiles monkeyracer`,
    ],
    execute: handlePercentiles,
  },
};

function debugListEmbed() {
  const embed = infoEmbed(
    "Debug commands",
    "Available debug subcommands:",
  );

  for (const subcommand of Object.values(subcommands)) {
    embed.addFields({
      name: subcommand.usage,
      value: subcommand.description,
      inline: false,
    });
  }

  return embed;
}

export const debugCommand: Command = {
  name: "debug",
  description: "Debug utilities for development",
  adminOnly: true,
  usage: `${PREFIX}debug <subcommand> [args]`,
  examples: [
    `${PREFIX}debug layout qwerty`,
    `${PREFIX}debug analyze qwerty`,
    `${PREFIX}debug corpus get reddit`,
    `${PREFIX}debug corpus get all`,
    `${PREFIX}debug cache warm`,
    `${PREFIX}debug percentiles`,
  ],
  async execute({ message, args }) {
    const trimmed = args.trim();
    if (!trimmed) {
      await replyEmbed(message, debugListEmbed());
      return;
    }

    const space = trimmed.indexOf(" ");
    const subcommandName = (space === -1 ? trimmed : trimmed.slice(0, space)).toLowerCase();
    const subArgs = space === -1 ? "" : trimmed.slice(space + 1).trim();

    const subcommand = subcommands[subcommandName];
    if (!subcommand) {
      await replyEmbed(
        message,
        errorEmbed(`Unknown debug subcommand: \`${subcommandName}\``),
      );
      return;
    }

    await subcommand.execute(message, subArgs);
  },
};
