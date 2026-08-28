import type { Message } from "discord.js";
import { PREFIX } from "../command/constants.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import { isAdmin } from "../config/admins.js";
import {
  errorEmbed,
  fitsInCodeBlock,
  infoEmbed,
  replyEmbed,
  textCodeBlock,
} from "../discord/embeds.js";
import { replyLoggedError } from "../discord/errors.js";
import {
  closeSuggestion,
  createSuggestion,
  getSuggestion,
  listOpenSuggestions,
  setSuggestionTitle,
  SuggestionStoreError,
  unvoteSuggestion,
  voteSuggestion,
} from "../suggestions/store.js";
import {
  MAX_SUGGESTION_LENGTH,
  MAX_SUGGESTION_PREVIEW,
  MAX_SUGGESTION_TITLE_LENGTH,
  MIN_SUGGESTION_LENGTH,
  MIN_SUGGESTION_TITLE_LENGTH,
  type Suggestion,
} from "../suggestions/types.js";

const ROW_INDENT = "  ";
const ID_WIDTH = 4;
const VOTE_WIDTH = 4;

function parseSuggestionId(value: string): number | undefined {
  const normalized = value.trim().replace(/^#/, "");
  if (!/^\d+$/.test(normalized)) return undefined;

  const id = Number.parseInt(normalized, 10);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

function previewText(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= MAX_SUGGESTION_PREVIEW) return trimmed;
  return `${trimmed.slice(0, MAX_SUGGESTION_PREVIEW - 1)}…`;
}

function listLabel(suggestion: Suggestion): string {
  return previewText(suggestion.title?.trim() || suggestion.text);
}

function formatSuggestionListText(suggestions: Suggestion[]): string {
  if (suggestions.length === 0) {
    return ["Open suggestions", `${ROW_INDENT}(none)`].join("\n");
  }

  const lines = suggestions.map((suggestion) => {
    const id = `#${suggestion.id}`.padEnd(ID_WIDTH);
    const votes = String(suggestion.votes.length)
      .padStart(VOTE_WIDTH)
      .concat("▲");
    const preview = listLabel(suggestion);
    return `${ROW_INDENT}${id}  ${votes}  ${preview}`;
  });

  return ["Open suggestions · by votes", ...lines].join("\n");
}

function formatSuggestionShowText(suggestion: Suggestion, viewerId: string): string {
  const voted = suggestion.votes.includes(viewerId) ? "yes" : "no";
  const created = new Date(suggestion.createdAt).toISOString().slice(0, 10);

  const lines = [
    `Suggestion #${suggestion.id}`,
  ];
  if (suggestion.title?.trim()) {
    lines.push(suggestion.title.trim());
    lines.push("");
    lines.push(suggestion.text.trim());
  } else {
    lines.push(suggestion.text.trim());
  }

  lines.push(
    "",
    `Author: ${suggestion.authorName}`,
    `Votes: ${suggestion.votes.length}`,
    `You voted: ${voted}`,
    `Created: ${created}`,
    `Status: ${suggestion.status}`,
  );

  return lines.join("\n");
}

async function handleSuggestAdd(message: Message, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    await replyUsage({ message, args: text }, suggestCommand);
    return;
  }

  if (trimmed.length < MIN_SUGGESTION_LENGTH) {
    await replyEmbed(
      message,
      errorEmbed(
        `Suggestions must be at least ${MIN_SUGGESTION_LENGTH} characters.`,
      ),
    );
    return;
  }

  if (trimmed.length > MAX_SUGGESTION_LENGTH) {
    await replyEmbed(
      message,
      errorEmbed(
        `Suggestions must be at most ${MAX_SUGGESTION_LENGTH} characters.`,
      ),
    );
    return;
  }

  try {
    const suggestion = await createSuggestion({
      text: trimmed,
      authorId: message.author.id,
      authorName: message.author.displayName || message.author.username,
    });

    await replyEmbed(
      message,
      infoEmbed(
        "Suggestion recorded",
        `Added **#${suggestion.id}**.\n\n${suggestion.text.trim()}`,
      ),
    );
  } catch (error) {
    await replyLoggedError(
      message,
      "Failed to save suggestion:",
      error,
      "Failed to save suggestion",
    );
  }
}

async function handleSuggestList(message: Message): Promise<void> {
  try {
    const suggestions = await listOpenSuggestions();
    const text = formatSuggestionListText(suggestions);

    if (!fitsInCodeBlock(text)) {
      await replyEmbed(
        message,
        errorEmbed(
          "Suggestion list is too long for Discord. Ask an admin to archive old entries.",
        ),
      );
      return;
    }

    await replyEmbed(
      message,
      infoEmbed("Suggestions", textCodeBlock(text)).setFooter({
        text: `${suggestions.length} open · vote with ${PREFIX}suggest vote <id>`,
      }),
    );
  } catch (error) {
    await replyLoggedError(
      message,
      "Failed to list suggestions:",
      error,
      "Failed to list suggestions",
    );
  }
}

async function handleSuggestVote(message: Message, idInput: string): Promise<void> {
  const id = parseSuggestionId(idInput);
  if (!id) {
    await replyEmbed(message, errorEmbed("Suggestion id must be a positive number."));
    return;
  }

  try {
    const suggestion = await voteSuggestion(id, message.author.id);
    await replyEmbed(
      message,
      infoEmbed(
        "Vote recorded",
        `You voted for **#${suggestion.id}** (${suggestion.votes.length} vote${suggestion.votes.length === 1 ? "" : "s"}).`,
      ),
    );
  } catch (error) {
    if (error instanceof SuggestionStoreError) {
      await replyEmbed(message, errorEmbed(error.message));
      return;
    }

    await replyLoggedError(
      message,
      "Failed to vote on suggestion:",
      error,
      "Failed to vote on suggestion",
    );
  }
}

async function handleSuggestUnvote(message: Message, idInput: string): Promise<void> {
  const id = parseSuggestionId(idInput);
  if (!id) {
    await replyEmbed(message, errorEmbed("Suggestion id must be a positive number."));
    return;
  }

  try {
    const suggestion = await unvoteSuggestion(id, message.author.id);
    await replyEmbed(
      message,
      infoEmbed(
        "Vote removed",
        `Removed your vote from **#${suggestion.id}** (${suggestion.votes.length} vote${suggestion.votes.length === 1 ? "" : "s"}).`,
      ),
    );
  } catch (error) {
    if (error instanceof SuggestionStoreError) {
      await replyEmbed(message, errorEmbed(error.message));
      return;
    }

    await replyLoggedError(
      message,
      "Failed to remove vote:",
      error,
      "Failed to remove vote",
    );
  }
}

async function handleSuggestTitle(
  message: Message,
  idInput: string,
  titleText: string,
): Promise<void> {
  const id = parseSuggestionId(idInput);
  if (!id) {
    await replyEmbed(message, errorEmbed("Suggestion id must be a positive number."));
    return;
  }

  const trimmed = titleText.trim();
  if (!trimmed) {
    await replyUsage({ message, args: titleText }, suggestCommand);
    return;
  }

  if (trimmed.length < MIN_SUGGESTION_TITLE_LENGTH) {
    await replyEmbed(
      message,
      errorEmbed(
        `Titles must be at least ${MIN_SUGGESTION_TITLE_LENGTH} characters.`,
      ),
    );
    return;
  }

  if (trimmed.length > MAX_SUGGESTION_TITLE_LENGTH) {
    await replyEmbed(
      message,
      errorEmbed(
        `Titles must be at most ${MAX_SUGGESTION_TITLE_LENGTH} characters.`,
      ),
    );
    return;
  }

  try {
    const suggestion = await setSuggestionTitle(id, message.author.id, trimmed);
    await replyEmbed(
      message,
      infoEmbed(
        "Title updated",
        `Set the title for **#${suggestion.id}** to:\n${suggestion.title}`,
      ),
    );
  } catch (error) {
    if (error instanceof SuggestionStoreError) {
      await replyEmbed(message, errorEmbed(error.message));
      return;
    }

    await replyLoggedError(
      message,
      "Failed to set suggestion title:",
      error,
      "Failed to set suggestion title",
    );
  }
}

async function handleSuggestClose(message: Message, idInput: string): Promise<void> {
  const id = parseSuggestionId(idInput);
  if (!id) {
    await replyEmbed(message, errorEmbed("Suggestion id must be a positive number."));
    return;
  }

  try {
    const userIsAdmin = await isAdmin(message.author.id);
    const suggestion = await closeSuggestion(id, message.author.id, {
      isAdmin: userIsAdmin,
    });
    const label = suggestion.title?.trim() || `#${suggestion.id}`;
    await replyEmbed(
      message,
      infoEmbed("Suggestion closed", `Closed **${label}**.`),
    );
  } catch (error) {
    if (error instanceof SuggestionStoreError) {
      await replyEmbed(message, errorEmbed(error.message));
      return;
    }

    await replyLoggedError(
      message,
      "Failed to close suggestion:",
      error,
      "Failed to close suggestion",
    );
  }
}

async function handleSuggestView(message: Message, idInput: string): Promise<void> {
  const id = parseSuggestionId(idInput);
  if (!id) {
    await replyEmbed(message, errorEmbed("Suggestion id must be a positive number."));
    return;
  }

  try {
    const suggestion = await getSuggestion(id);
    if (!suggestion) {
      await replyEmbed(message, errorEmbed(`Unknown suggestion \`#${id}\`.`));
      return;
    }

    const text = formatSuggestionShowText(suggestion, message.author.id);
    const embedTitle = suggestion.title?.trim()
      ? `Suggestion #${suggestion.id} · ${suggestion.title.trim()}`
      : `Suggestion #${suggestion.id}`;
    await replyEmbed(
      message,
      infoEmbed(embedTitle, fitsInCodeBlock(text) ? textCodeBlock(text) : text),
    );
  } catch (error) {
    await replyLoggedError(
      message,
      "Failed to view suggestion:",
      error,
      "Failed to view suggestion",
    );
  }
}

export const suggestCommand: Command = {
  name: "suggest",
  description: "Submit, list, vote on, or view feature suggestions",
  usage: `${PREFIX}suggest <text>`,
  usageLines: [
    `${PREFIX}suggest <text>`,
    `${PREFIX}suggest list`,
    `${PREFIX}suggest title <id> <text>`,
    `${PREFIX}suggest vote <id>`,
    `${PREFIX}suggest unvote <id>`,
    `${PREFIX}suggest view <id>`,
    `${PREFIX}suggest close <id>`,
  ],
  notes:
    "Suggestions use incrementing ids (#1, #2, …). Authors can set a title or close their own suggestions. Admins can close any suggestion. Only open suggestions appear in list. One vote per user per suggestion.",
  examples: [
    `${PREFIX}suggest add pagination to likes`,
    `${PREFIX}suggest title 1 Pagination for likes`,
    `${PREFIX}suggest list`,
    `${PREFIX}suggest vote 3`,
    `${PREFIX}suggest unvote 3`,
    `${PREFIX}suggest view 3`,
    `${PREFIX}suggest close 3`,
  ],
  async execute({ message, args }) {
    const trimmed = args.trim();
    if (!trimmed) {
      await replyUsage({ message, args }, suggestCommand);
      return;
    }

    const parts = trimmed.split(/\s+/);
    const action = parts[0]!.toLowerCase();

    if (action === "list") {
      if (parts.length > 1) {
        await replyUsage({ message, args }, suggestCommand);
        return;
      }
      await handleSuggestList(message);
      return;
    }

    if (action === "vote") {
      if (parts.length !== 2) {
        await replyUsage({ message, args }, suggestCommand);
        return;
      }
      await handleSuggestVote(message, parts[1]!);
      return;
    }

    if (action === "unvote") {
      if (parts.length !== 2) {
        await replyUsage({ message, args }, suggestCommand);
        return;
      }
      await handleSuggestUnvote(message, parts[1]!);
      return;
    }

    if (action === "view") {
      if (parts.length !== 2) {
        await replyUsage({ message, args }, suggestCommand);
        return;
      }
      await handleSuggestView(message, parts[1]!);
      return;
    }

    if (action === "title") {
      if (parts.length < 3) {
        await replyUsage({ message, args }, suggestCommand);
        return;
      }
      await handleSuggestTitle(message, parts[1]!, parts.slice(2).join(" "));
      return;
    }

    if (action === "close") {
      if (parts.length !== 2) {
        await replyUsage({ message, args }, suggestCommand);
        return;
      }
      await handleSuggestClose(message, parts[1]!);
      return;
    }

    await handleSuggestAdd(message, trimmed);
  },
};
