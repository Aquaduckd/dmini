import { DEPRECATED_CMINI_PREFIXES, PREFIX } from "./constants.js";

interface ParsedDeprecatedCmini {
  command: string | null;
  args: string;
}

interface MigrationTarget {
  command: string;
  args?: string;
  note?: string;
  also?: Array<{ command: string; args?: string }>;
}

type MigrationRule =
  | string
  | ((args: string) => MigrationTarget | null);

const STAT_EXAMPLE_COMMANDS = new Set([
  "sfbs",
  "sfs",
  "rolls",
  "redirects",
  "inrolls",
  "outrolls",
  "alternates",
  "onehands",
]);

const STAT_EXAMPLE_MAP: Record<string, string> = {
  sfbs: "sfb",
  sfs: "sfs",
  rolls: "roll",
  redirects: "redirect",
  inrolls: "inroll2",
  outrolls: "outroll2",
  alternates: "alt",
  onehands: "alt",
};

const CMINI_COMMAND_MAP: Record<string, MigrationRule> = {
  add: "add",
  remove: "remove",
  rename: "rename",
  swap: "swap",
  cycle: "swap",
  "swap!": "swap",
  "cycle!": "swap",
  magic: "magic",
  clearmagic: "clearmagic",
  appendmagic: (args) => ({
    command: "addmagic",
    args,
    note: "Use `--append` if you want to add rules without replacing existing ones.",
  }),
  setmagic: (args) => ({
    command: "addmagic",
    args,
    note: "`addmagic` replaces existing magic rules unless you pass `--append`.",
  }),
  like: "like",
  unlike: "unlike",
  likes: "likes",
  suggest: "suggest",
  random: "random",
  help: "help",
  freq: "freq",
  freqs: "freqs",
  view: (args) => ({
    command: "layout",
    args,
    also: [{ command: "analyze", args }],
  }),
  list: "layouts",
  rank: "leaderboard",
  fingermap: (args) => ({
    command: "layout",
    args: args ? `${args} --fingermap` : "--fingermap",
  }),
  fingers: (args) => ({
    command: "analyze",
    args,
    note: "Finger usage is shown in the analyze output.",
  }),
  corpus: (args) => ({
    command: "config",
    args: args ? `corpus ${args}` : "corpus",
  }),
  examples: "find",
  search: (args) => ({
    command: "layouts",
    args: args.includes("--name") ? args.replace("--name", "--search") : `--search ${args}`,
    note: "cmini `search` filtered layouts; dmini `find` searches corpus words instead.",
  }),
  filter: () => ({
    command: "leaderboard",
    note:
      "cmini `filter` combined layout search and stat ranking. Try `leaderboard`, `layouts --search`, or `find`.",
  }),
  stats: () => ({
    command: "about",
    note: "cmini `stats` showed global bot stats. `about` is the closest dmini equivalent.",
  }),
  mod: (args) => ({
    command: "swap",
    args,
    note: "Layout editing in dmini is mostly `swap`, `setboard`, and `addmagic`.",
  }),
  gh: "about",
  github: "about",
};

function resolveMigration(command: string, args: string): MigrationTarget | null {
  if (STAT_EXAMPLE_COMMANDS.has(command)) {
    const stat = STAT_EXAMPLE_MAP[command];
    if (!stat) return null;
    return {
      command: "examples",
      args: args ? `${stat} ${args}` : stat,
    };
  }

  const rule = CMINI_COMMAND_MAP[command];
  if (rule === undefined) return null;
  if (typeof rule === "string") {
    return { command: rule, args: args || undefined };
  }
  return rule(args);
}

export function parseDeprecatedCminiMessage(
  content: string,
): ParsedDeprecatedCmini | null {
  const trimmed = content.trim();
  const lower = trimmed.toLowerCase();

  let prefix: string | null = null;
  for (const candidate of DEPRECATED_CMINI_PREFIXES) {
    if (lower === candidate || lower.startsWith(`${candidate} `)) {
      prefix = candidate;
      break;
    }
  }

  if (!prefix) return null;

  const rest = trimmed.slice(prefix.length).trim();
  if (!rest) {
    return { command: null, args: "" };
  }

  const space = rest.indexOf(" ");
  if (space === -1) {
    return { command: rest.toLowerCase(), args: "" };
  }

  return {
    command: rest.slice(0, space).toLowerCase(),
    args: rest.slice(space + 1).trim(),
  };
}

export function buildCminiDeprecationMessage(content: string): string {
  const parsed = parseDeprecatedCminiMessage(content);
  if (!parsed) {
    return `cmini has been replaced by dmini. Use \`${PREFIX}help\` to get started.`;
  }

  if (!parsed.command) {
    return `cmini has been replaced by dmini. Use \`${PREFIX}help\` to get started.`;
  }

  const migration = resolveMigration(parsed.command, parsed.args);
  if (!migration) {
    return `cmini has been replaced by dmini. Use \`${PREFIX}help\` to get started.`;
  }

  const suggestions = [
    migration,
    ...(migration.also ?? []),
  ];
  const formatted = suggestions.map((suggestion) => {
    const argsSuffix = suggestion.args ? ` ${suggestion.args}` : "";
    return `\`${PREFIX}${suggestion.command}${argsSuffix}\``;
  });

  const lines = [
    formatted.length === 1
      ? `cmini is deprecated. Try ${formatted[0]} instead.`
      : formatted.length === 2
        ? `cmini is deprecated. Try ${formatted[0]} or ${formatted[1]} instead.`
        : `cmini is deprecated. Try:\n${formatted.map((suggestion) => `- ${suggestion}`).join("\n")}`,
  ];

  if (migration.note) {
    lines.push(migration.note);
  }

  return lines.join("\n");
}
