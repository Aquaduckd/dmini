import { isAdmin } from "../config/admins.js";
import type { Command } from "./types.js";

const commands = new Map<string, Command>();
const aliases = new Map<string, string>();

export function registerCommand(command: Command): void {
  commands.set(command.name, command);

  for (const alias of command.aliases ?? []) {
    aliases.set(alias.toLowerCase(), command.name);
  }
}

export function clearCommands(): void {
  commands.clear();
  aliases.clear();
}

export function getCommand(name: string): Command | undefined {
  const key = name.toLowerCase();
  const resolved = aliases.get(key) ?? key;
  return commands.get(resolved);
}

export function getAllCommands(): Command[] {
  return [...commands.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function canAccessCommand(
  command: Command,
  userIsAdmin: boolean,
): boolean {
  return !command.adminOnly || userIsAdmin;
}

export async function getCommandsForUser(userId: string): Promise<Command[]> {
  const userIsAdmin = await isAdmin(userId);
  return getAllCommands().filter((command) =>
    canAccessCommand(command, userIsAdmin),
  );
}

export async function userCanRunCommand(
  command: Command,
  userId: string,
): Promise<boolean> {
  if (!command.adminOnly) return true;
  return isAdmin(userId);
}

export function resolveCommandName(name: string): string | undefined {
  const key = name.toLowerCase();
  return aliases.get(key) ?? (commands.has(key) ? key : undefined);
}
