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
import { replyLoggedError } from "../discord/errors.js";
import { analyzeLayoutRaw, Mana2Error } from "../mana2/analyze.js";
import {
  ANALYZER_VERSION,
  clearAnalysisCache,
  getCacheStatus,
  getLayoutCacheVersionCounts,
  warmAnalysisCache,
} from "../mana2/cache.js";
import {
  buildAndSaveCorpusPercentileCutoffs,
  listPercentileCacheSummaries,
  PERCENTILE_BUCKET_COUNT,
} from "../mana2/percentiles.js";
import {
  layoutNotAnalyzableMessage,
  missingAnalysisCharacters,
} from "../layout/types.js";
import { CorpusError, downloadAllCorpora, downloadCorpus, listCorpora } from "../mana2/corpus.js";
import { togglePublicAccessBlocked } from "../config/access.js";
import { collectSystemInfo, formatSystemInfo } from "../system/info.js";

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
      await replyLoggedError(
        message,
        "Failed to fetch layout:",
        error,
        "Failed to fetch layout",
      );
      return;
    }

    await replyLoggedError(
      message,
      "Failed to fetch layout:",
      error,
      "Failed to fetch layout",
    );
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

    if (error instanceof LayoutApiError || error instanceof Mana2Error) {
      await replyLoggedError(
        message,
        "Failed to analyze layout:",
        error,
        "Failed to analyze layout",
      );
      return;
    }

    await replyLoggedError(
      message,
      "Failed to analyze layout:",
      error,
      "Failed to analyze layout",
    );
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
      await replyLoggedError(
        message,
        "Failed to download all corpora:",
        error,
        "Failed to download corpora",
      );
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

    await replyLoggedError(
      message,
      "Failed to download corpus:",
      error,
      "Failed to download corpus",
    );
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
          for (const failure of result.errors.slice(0, 5)) {
            console.error(
              `Cache warm failed for ${failure.layout} (${result.corpus}):`,
              failure.message,
            );
            lines.push(`- \`${failure.layout}\`: failed (see logs)`);
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

      await replyLoggedError(
        message,
        "Failed to warm analysis cache:",
        error,
        "Failed to warm analysis cache",
      );
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

async function handleVersions(message: Message): Promise<void> {
  const [layoutCounts, percentileSummaries] = await Promise.all([
    getLayoutCacheVersionCounts(),
    listPercentileCacheSummaries(),
  ]);

  const versionLines = Object.entries(layoutCounts.byVersion)
    .map(([version, count]) => [Number(version), count] as const)
    .sort(([a], [b]) => b - a)
    .map(([version, count]) => {
      const label =
        version === layoutCounts.currentVersion
          ? `v${version} (current)`
          : version === 0
            ? "unknown"
            : `v${version}`;
      return `- ${label}: **${count}**`;
    });

  const lines = [
    `Current analyzer: **${layoutCounts.currentVersion}**`,
    "",
    "**Layout cache**",
    ...(versionLines.length > 0 ? versionLines : ["- (none)"]),
    `- Total files: **${layoutCounts.totalFiles}**`,
    "",
    "**Percentiles**",
  ];

  if (percentileSummaries.length === 0) {
    lines.push("- (none)");
  } else {
    for (const summary of percentileSummaries) {
      const builtAt = new Date(summary.built_at);
      const builtLabel = Number.isNaN(builtAt.getTime())
        ? summary.built_at
        : builtAt.toISOString().slice(0, 10);
      lines.push(
        `- \`${summary.corpus}\`: v**${summary.analyzer_version}** · **${summary.layout_count}** layouts · built ${builtLabel}`,
      );
    }
  }

  await replyEmbed(message, infoEmbed("Cache versions", lines.join("\n")));
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

    await replyLoggedError(
      message,
      "Failed to build percentile cutoffs:",
      error,
      "Failed to build percentile cutoffs",
    );
  }
}

async function handleSystem(message: Message): Promise<void> {
  try {
    const info = await collectSystemInfo();
    await replyEmbed(message, infoEmbed("System status", formatSystemInfo(info)));
  } catch (error) {
    await replyLoggedError(
      message,
      "Failed to collect system info:",
      error,
      "Failed to collect system info",
    );
  }
}

async function handle1984(message: Message): Promise<void> {
  const locked = await togglePublicAccessBlocked();
  await replyEmbed(
    message,
    infoEmbed(
      "1984",
      locked
        ? "Public access **disabled**. Only admins can use dmini."
        : "Public access **enabled**. Everyone can use dmini again.",
    ),
  );
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
  versions: {
    description: "Show layout cache counts by analyzer version and percentile metadata",
    usage: `${PREFIX}debug versions`,
    examples: [`${PREFIX}debug versions`],
    execute: (message) => handleVersions(message),
  },
  system: {
    description: "Show memory usage, load, disk, and process stats",
    usage: `${PREFIX}debug system`,
    examples: [`${PREFIX}debug system`],
    execute: (message) => handleSystem(message),
  },
  "1984": {
    description: "Toggle whether non-admins can use dmini",
    usage: `${PREFIX}debug 1984`,
    examples: [`${PREFIX}debug 1984`],
    execute: (message) => handle1984(message),
  },
};

const DEBUG_GROUPS: { label: string; names: string[] }[] = [
  { label: "Layouts", names: ["layout", "analyze"] },
  { label: "Corpora", names: ["corpus"] },
  { label: "Cache", names: ["cache", "percentiles", "versions"] },
  { label: "System", names: ["system", "1984"] },
];

function formatDebugSubcommandList(entries: DebugSubcommand[]): string {
  return entries
    .map((entry) => `\`${entry.usage}\` — ${entry.description}`)
    .join("\n");
}

function debugListEmbed() {
  const embed = infoEmbed(
    "Debug commands",
    `Use \`${PREFIX}debug <subcommand>\` for admin utilities.`,
  );

  const grouped = new Set<string>();

  for (const group of DEBUG_GROUPS) {
    const entries = group.names
      .map((name) => subcommands[name])
      .filter((entry): entry is DebugSubcommand => entry !== undefined);

    for (const name of group.names) {
      grouped.add(name);
    }

    if (entries.length === 0) continue;

    embed.addFields({
      name: group.label,
      value: formatDebugSubcommandList(entries),
      inline: false,
    });
  }

  const other = Object.entries(subcommands)
    .filter(([name]) => !grouped.has(name))
    .map(([, entry]) => entry)
    .sort((a, b) => a.usage.localeCompare(b.usage));

  if (other.length > 0) {
    embed.addFields({
      name: "Other",
      value: formatDebugSubcommandList(other),
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
    `${PREFIX}debug versions`,
    `${PREFIX}debug system`,
    `${PREFIX}debug 1984`,
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
