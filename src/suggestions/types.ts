export type SuggestionStatus = "open" | "closed";

export interface Suggestion {
  id: number;
  text: string;
  title?: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  status: SuggestionStatus;
  votes: string[];
}

export interface SuggestionStore {
  nextId: number;
  suggestions: Suggestion[];
}

export const MIN_SUGGESTION_LENGTH = 10;
export const MAX_SUGGESTION_LENGTH = 1000;
export const MIN_SUGGESTION_TITLE_LENGTH = 3;
export const MAX_SUGGESTION_TITLE_LENGTH = 80;
export const MAX_SUGGESTION_PREVIEW = 72;
