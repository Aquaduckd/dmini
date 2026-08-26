import { EmbedBuilder, type Message, type MessageReplyOptions } from "discord.js";

export const Colors = {
  primary: 0x2e2e33,
  error: 0xed4245,
} as const;

const EMBED_DESCRIPTION_LIMIT = 4096;
const CODE_BLOCK_OVERHEAD = 8;

export function errorEmbed(description: string, title = "Error"): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.error)
    .setTitle(title)
    .setDescription(description);
}

export function infoEmbed(
  title: string,
  description: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.primary)
    .setTitle(title)
    .setDescription(description);
}

export async function replyEmbed(
  message: Message,
  embed: EmbedBuilder,
  options: Omit<MessageReplyOptions, "embeds"> = {},
): Promise<void> {
  await message.reply({ embeds: [embed], ...options });
}

export function fitsInCodeBlock(text: string): boolean {
  return text.length + CODE_BLOCK_OVERHEAD <= EMBED_DESCRIPTION_LIMIT;
}

export function jsonCodeBlock(json: string): string {
  return `\`\`\`json\n${json}\n\`\`\``;
}

export function textCodeBlock(text: string): string {
  return `\`\`\`\n${text}\n\`\`\``;
}

export function ansiCodeBlock(text: string): string {
  return `\`\`\`ansi\n${text}\n\`\`\``;
}

export function layoutJsonEmbed(name: string, json: string): EmbedBuilder {
  return infoEmbed(name, jsonCodeBlock(json));
}
