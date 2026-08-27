import type { Message } from "discord.js";

export interface CommandContext {
  message: Message;
  args: string;
}

// Help sections, in the order they appear in `!dmini help`. Every command
// declares its own group, so a new command can never silently go unlisted.
export const COMMAND_GROUPS = [
  "General",
  "Layouts",
  "Editing",
  "Social",
  "Analysis",
  "Settings",
  "Admin",
] as const;

export type CommandGroup = (typeof COMMAND_GROUPS)[number];

export interface Command {
  name: string;
  description: string;
  usage: string;
  /** Section this command is listed under in the !dmini help command. */
  group: CommandGroup;
  notes?: string;
  aliases?: string[];
  examples?: string[];
  /** Hidden from help and blocked for non-admins. */
  adminOnly?: boolean;
  execute(context: CommandContext): Promise<void>;
}
