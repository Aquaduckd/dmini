import { EmbedBuilder } from "discord.js";
import { infoEmbed, replyEmbed } from "../discord/embeds.js";
import { PREFIX } from "./constants.js";
import type { Command, CommandContext } from "./types.js";

const HELP_GROUPS: { label: string; names: string[] }[] = [
  { label: "General", names: ["help", "about"] },
  { label: "Layouts", names: ["layout", "layouts", "magic"] },
  { label: "Editing", names: ["add", "addmagic", "copy", "remove", "rename", "setboard", "clearmagic", "swap"] },
  { label: "Social", names: ["like", "unlike", "gift"] },
  { label: "Analysis", names: ["analyze", "find", "percentiles", "examples"] },
  { label: "Settings", names: ["config"] },
  { label: "Admin", names: ["debug"] },
];

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
  const byName = new Map(commands.map((command) => [command.name, command]));
  const grouped = new Set<string>();

  for (const group of HELP_GROUPS) {
    const groupCommands = group.names
      .map((name) => byName.get(name))
      .filter((command): command is Command => command !== undefined);

    for (const command of groupCommands) {
      grouped.add(command.name);
    }

    if (groupCommands.length === 0) continue;

    embed.addFields({
      name: group.label,
      value: formatCommandList(groupCommands),
      inline: false,
    });
  }

  const other = commands
    .filter((command) => !grouped.has(command.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (other.length === 0) return;

  embed.addFields({
    name: "Other",
    value: formatCommandList(other),
    inline: false,
  });
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
