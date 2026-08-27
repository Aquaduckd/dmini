import { PREFIX } from "../command/constants.js";
import type { Command } from "../command/types.js";
import { errorEmbed, replyEmbed } from "../discord/embeds.js";
import { commandHelpEmbed, commandListEmbed } from "../command/format.js";
import {
  getCommand,
  getCommandsForUser,
  resolveCommandName,
  userCanRunCommand,
} from "../command/registry.js";

export const helpCommand: Command = {
  name: "help",
  description: "Show available commands or detailed help for one command",
  usage: `${PREFIX}help [command]`,
  group: "General",
  aliases: ["commands", "h"],
  examples: [`${PREFIX}help`, `${PREFIX}help debug`],
  async execute({ message, args }) {
    const query = args.trim().toLowerCase();

    if (!query) {
      await replyEmbed(
        message,
        commandListEmbed(await getCommandsForUser(message.author.id)),
      );
      return;
    }

    const resolved = resolveCommandName(query);
    const command = resolved ? getCommand(resolved) : undefined;

    if (
      !command ||
      !(await userCanRunCommand(command, message.author.id))
    ) {
      await replyEmbed(
        message,
        errorEmbed(
          `Unknown command: \`${query}\`. Use \`${PREFIX}help\` to see available commands.`,
        ),
      );
      return;
    }

    await replyEmbed(message, commandHelpEmbed(command));
  },
};
