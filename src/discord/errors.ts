import type { Message } from "discord.js";
import { errorEmbed, replyEmbed } from "./embeds.js";

export const LOG_CHECK_HINT = "Check server logs for details.";

export function loggedErrorMessage(summary: string): string {
  const trimmed = summary.trimEnd();
  if (trimmed.endsWith(".")) {
    return `${trimmed} ${LOG_CHECK_HINT}`;
  }
  return `${trimmed}. ${LOG_CHECK_HINT}`;
}

export async function replyLoggedError(
  message: Message,
  context: string,
  error: unknown,
  summary = "Something went wrong",
): Promise<void> {
  console.error(context, error);
  await replyEmbed(message, errorEmbed(loggedErrorMessage(summary)));
}
