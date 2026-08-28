import type { Message } from "discord.js";

export interface CommandContext {
  message: Message;
  args: string;
}

export interface Command {
  name: string;
  description: string;
  usage: string;
  /** Multi-line usage for help embeds. Falls back to `usage` when omitted. */
  usageLines?: string[];
  notes?: string;
  aliases?: string[];
  examples?: string[];
  /** Hidden from help and blocked for non-admins. */
  adminOnly?: boolean;
  execute(context: CommandContext): Promise<void>;
}
