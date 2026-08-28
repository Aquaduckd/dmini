import type { RenderMode } from "../config/user.js";

export interface CommandFlags {
  append?: boolean;
  asc?: boolean;
  board?: string;
  corpus?: string;
  desc?: boolean;
  layoutFilter?: "magic" | "thumb" | "regular";
  likes?: boolean;
  limit?: number;
  max?: number;
  min?: number;
  page?: number;
  renderMode?: RenderMode;
  search?: string;
  sort?: string;
}

export interface ParseFlagsOptions {
  append?: boolean;
  asc?: boolean;
  board?: boolean;
  corpus?: boolean;
  desc?: boolean;
  layoutFilter?: boolean;
  likes?: boolean;
  limit?: boolean;
  max?: boolean;
  min?: boolean;
  page?: boolean;
  renderMode?: boolean;
  search?: boolean;
  sort?: boolean;
}

export function parseCommandArgs(
  args: string,
  options: ParseFlagsOptions = {},
): { positional: string[]; flags: CommandFlags } {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  const positional: string[] = [];
  const flags: CommandFlags = {};

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]!;

    if (options.append && part === "--append") {
      flags.append = true;
      continue;
    }

    if (options.asc && part === "--asc") {
      if (flags.desc) {
        throw new FlagParseError("Use only one of --asc or --desc.");
      }
      flags.asc = true;
      continue;
    }

    if (options.desc && part === "--desc") {
      if (flags.asc) {
        throw new FlagParseError("Use only one of --asc or --desc.");
      }
      flags.desc = true;
      continue;
    }

    if (options.board && part === "--board") {
      const value = parts[++index];
      if (!value || value.startsWith("-")) {
        throw new FlagParseError("Missing value for --board");
      }
      flags.board = value;
      continue;
    }

    if (options.corpus && (part === "--corpus" || part === "-c")) {
      const value = parts[++index];
      if (!value || value.startsWith("-")) {
        throw new FlagParseError("Missing value for --corpus");
      }
      flags.corpus = value;
      continue;
    }

    if (options.layoutFilter && part === "--magic") {
      if (flags.layoutFilter) {
        throw new FlagParseError("Use only one of --magic, --thumb, or --regular.");
      }
      flags.layoutFilter = "magic";
      continue;
    }

    if (options.layoutFilter && part === "--thumb") {
      if (flags.layoutFilter) {
        throw new FlagParseError("Use only one of --magic, --thumb, or --regular.");
      }
      flags.layoutFilter = "thumb";
      continue;
    }

    if (options.layoutFilter && part === "--regular") {
      if (flags.layoutFilter) {
        throw new FlagParseError("Use only one of --magic, --thumb, or --regular.");
      }
      flags.layoutFilter = "regular";
      continue;
    }

    if (options.likes && part === "--likes") {
      flags.likes = true;
      continue;
    }

    if (options.max && part === "--max") {
      const value = parts[++index];
      if (!value || value.startsWith("-")) {
        throw new FlagParseError("Missing value for --max");
      }
      flags.max = parseNumericFlag(value, "--max");
      continue;
    }

    if (options.min && part === "--min") {
      const value = parts[++index];
      if (!value || value.startsWith("-")) {
        throw new FlagParseError("Missing value for --min");
      }
      flags.min = parseNumericFlag(value, "--min");
      continue;
    }

    if (options.limit && (part === "--limit" || part === "-l")) {
      const value = parts[++index];
      if (!value || value.startsWith("-")) {
        throw new FlagParseError("Missing value for --limit");
      }
      const parsed = Number(value);
      if (!Number.isInteger(parsed)) {
        throw new FlagParseError("Limit must be an integer");
      }
      flags.limit = parsed;
      continue;
    }

    if (options.page && (part === "--page" || part === "-p")) {
      const value = parts[++index];
      if (!value || value.startsWith("-")) {
        throw new FlagParseError("Missing value for --page");
      }
      const parsed = Number(value);
      if (!Number.isInteger(parsed)) {
        throw new FlagParseError("Page must be an integer");
      }
      flags.page = parsed;
      continue;
    }

    if (options.sort && (part === "--sort" || part === "-s")) {
      const value = parts[++index];
      if (!value || value.startsWith("-")) {
        throw new FlagParseError("Missing value for --sort");
      }
      flags.sort = value;
      continue;
    }

    if (options.search && (part === "--search" || part === "-q")) {
      const value = parts[++index];
      if (!value || value.startsWith("-")) {
        throw new FlagParseError("Missing value for --search");
      }
      flags.search = value;
      continue;
    }

    if (options.renderMode && part === "--heatmap") {
      if (flags.renderMode === "fingermap") {
        throw new FlagParseError("Cannot use both --heatmap and --fingermap.");
      }
      flags.renderMode = "heatmap";
      continue;
    }

    if (options.renderMode && part === "--fingermap") {
      if (flags.renderMode === "heatmap") {
        throw new FlagParseError("Cannot use both --heatmap and --fingermap.");
      }
      flags.renderMode = "fingermap";
      continue;
    }

    if (part.startsWith("-")) {
      throw new FlagParseError(`Unknown flag: ${part}`);
    }

    positional.push(part);
  }

  return { positional, flags };
}

export class FlagParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlagParseError";
  }
}

function parseNumericFlag(value: string, flagName: string): number {
  const normalized = value.trim().endsWith("%")
    ? value.trim().slice(0, -1).trim()
    : value.trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new FlagParseError(`${flagName} must be a number`);
  }
  return parsed;
}
