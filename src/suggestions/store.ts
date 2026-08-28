import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Suggestion, SuggestionStore } from "./types.js";

const SUGGESTIONS_PATH = path.resolve(process.cwd(), ".dmini/suggestions.json");

export class SuggestionStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SuggestionStoreError";
  }
}

async function loadStore(): Promise<SuggestionStore> {
  try {
    const raw = await readFile(SUGGESTIONS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<SuggestionStore>;
    return {
      nextId: Number.isFinite(parsed.nextId) ? Math.max(1, parsed.nextId!) : 1,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  } catch {
    return { nextId: 1, suggestions: [] };
  }
}

async function saveStore(store: SuggestionStore): Promise<void> {
  await mkdir(path.dirname(SUGGESTIONS_PATH), { recursive: true });
  await writeFile(
    SUGGESTIONS_PATH,
    `${JSON.stringify(store, null, 2)}\n`,
    "utf8",
  );
}

function sortSuggestions(suggestions: Suggestion[]): Suggestion[] {
  return [...suggestions].sort((a, b) => {
    const voteDiff = b.votes.length - a.votes.length;
    if (voteDiff !== 0) return voteDiff;
    return b.id - a.id;
  });
}

export async function listOpenSuggestions(): Promise<Suggestion[]> {
  const store = await loadStore();
  return sortSuggestions(
    store.suggestions.filter((suggestion) => suggestion.status === "open"),
  );
}

export async function getSuggestion(id: number): Promise<Suggestion | undefined> {
  const store = await loadStore();
  return store.suggestions.find((suggestion) => suggestion.id === id);
}

export async function createSuggestion(input: {
  text: string;
  authorId: string;
  authorName: string;
}): Promise<Suggestion> {
  const store = await loadStore();
  const suggestion: Suggestion = {
    id: store.nextId,
    text: input.text,
    authorId: String(input.authorId),
    authorName: input.authorName,
    createdAt: new Date().toISOString(),
    status: "open",
    votes: [String(input.authorId)],
  };

  store.nextId += 1;
  store.suggestions.push(suggestion);
  await saveStore(store);
  return suggestion;
}

export async function voteSuggestion(
  id: number,
  userId: string,
): Promise<Suggestion> {
  const store = await loadStore();
  const suggestion = store.suggestions.find((entry) => entry.id === id);
  if (!suggestion) {
    throw new SuggestionStoreError(`Unknown suggestion \`#${id}\`.`);
  }
  if (suggestion.status !== "open") {
    throw new SuggestionStoreError(`Suggestion \`#${id}\` is not open.`);
  }

  const voterId = String(userId);
  if (suggestion.votes.includes(voterId)) {
    throw new SuggestionStoreError(`You already voted for \`#${id}\`.`);
  }

  suggestion.votes.push(voterId);
  await saveStore(store);
  return suggestion;
}

export async function unvoteSuggestion(
  id: number,
  userId: string,
): Promise<Suggestion> {
  const store = await loadStore();
  const suggestion = store.suggestions.find((entry) => entry.id === id);
  if (!suggestion) {
    throw new SuggestionStoreError(`Unknown suggestion \`#${id}\`.`);
  }
  if (suggestion.status !== "open") {
    throw new SuggestionStoreError(`Suggestion \`#${id}\` is not open.`);
  }

  const voterId = String(userId);
  const index = suggestion.votes.indexOf(voterId);
  if (index === -1) {
    throw new SuggestionStoreError(`You haven't voted for \`#${id}\`.`);
  }

  suggestion.votes.splice(index, 1);
  await saveStore(store);
  return suggestion;
}

export async function setSuggestionTitle(
  id: number,
  userId: string,
  title: string,
): Promise<Suggestion> {
  const store = await loadStore();
  const suggestion = store.suggestions.find((entry) => entry.id === id);
  if (!suggestion) {
    throw new SuggestionStoreError(`Unknown suggestion \`#${id}\`.`);
  }
  if (suggestion.authorId !== String(userId)) {
    throw new SuggestionStoreError(
      `Only the author of \`#${id}\` can set its title.`,
    );
  }
  if (suggestion.status !== "open") {
    throw new SuggestionStoreError(`Suggestion \`#${id}\` is not open.`);
  }

  suggestion.title = title;
  await saveStore(store);
  return suggestion;
}

export async function closeSuggestion(
  id: number,
  userId: string,
  options: { isAdmin?: boolean } = {},
): Promise<Suggestion> {
  const store = await loadStore();
  const suggestion = store.suggestions.find((entry) => entry.id === id);
  if (!suggestion) {
    throw new SuggestionStoreError(`Unknown suggestion \`#${id}\`.`);
  }
  if (suggestion.status === "closed") {
    throw new SuggestionStoreError(`Suggestion \`#${id}\` is already closed.`);
  }
  if (
    suggestion.authorId !== String(userId) &&
    !options.isAdmin
  ) {
    throw new SuggestionStoreError(
      `Only the author of \`#${id}\` can close it.`,
    );
  }

  suggestion.status = "closed";
  await saveStore(store);
  return suggestion;
}
