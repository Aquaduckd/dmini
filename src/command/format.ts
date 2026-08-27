import { EmbedBuilder } from "discord.js";
import { infoEmbed, replyEmbed } from "../discord/embeds.js";
import { PREFIX } from "./constants.js";
import { COMMAND_GROUPS, type Command, type CommandContext } from "./types.js";

function formatCommandName(command: Command): string {
  return `\`${PREFIX}${command.name}\``;
}

function formatCommandList(commands: Command[]): string {
  return commands.map(formatCommandName).join(" ");
}

function addGroupedCommandFields(
  embed: EmbedBuilder,
  commands: Command[],
): void {
  for (const group of COMMAND_GROUPS) {
    const groupCommands = commands.filter(
      (command) => command.group === group,
    );

    if (groupCommands.length === 0) continue;

    embed.addFields({
      name: group,
      value: formatCommandList(groupCommands),
      inline: false,
    });
  }
}

export async function replyUsage(
  context: CommandContext,
  command: Command,
): Promise<void> {
  await replyEmbed(
    context.message,
    infoEmbed("Missing argument", `Usage: \`${command.usage}\``)
      .setFooter({ text: `See ${PREFIX}help ${command.name} for details` }),
  );
}

export function commandListEmbed(commands: Command[]): EmbedBuilder {
  const embed = infoEmbed(
    "Commands",
    `Use \`${PREFIX}help <command>\` for details on a specific command.`,
  );

  addGroupedCommandFields(embed, commands);

  return embed;
}

export function commandHelpEmbed(command: Command): EmbedBuilder {
  const embed = infoEmbed(command.name, command.description).addFields({
    name: "Usage",
    value: `\`${command.usage}\``,
    inline: false,
  });

  if (command.aliases?.length) {
    embed.addFields({
      name: "Aliases",
      value: command.aliases.map((alias) => `\`${PREFIX}${alias}\``).join(", "),
      inline: false,
    });
  }

  if (command.notes) {
    embed.addFields({
      name: "Notes",
      value: command.notes,
      inline: false,
    });
  }

  if (command.examples?.length) {
    embed.addFields({
      name: "Examples",
      value: command.examples.join("\n"),
      inline: false,
    });
  }

  return embed;
}
