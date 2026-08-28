import type { LayoutSummary } from "../../api/layouts.js";
import type { LayoutLeaderboardFilter } from "../../mana2/leaderboard.js";
import type { LeaderboardEntry } from "../../mana2/leaderboard.js";
import type { StatExample } from "../../mana2/examples.js";
import type { PaginationInfo } from "../pagination.js";

export type LayoutSort = "name" | "likes" | "created" | "modified";
export type LayoutSortDirection = "asc" | "desc";

export interface PaginatedPage {
  description: string;
  pagination: PaginationInfo;
}

export type PaginationSessionKind =
  | "layouts"
  | "likes"
  | "inspect-likes"
  | "leaderboard"
  | "examples";

export interface LayoutListScopeState {
  label: string;
  title: string;
  userId?: string;
}

export interface LayoutsPaginationState {
  scope: LayoutListScopeState;
  sort: LayoutSort;
  sortDirection: LayoutSortDirection;
  allLayouts: LayoutSummary[];
  limit: number;
  corpus: string;
}

export interface LikesPaginationState {
  scopeLabel: string;
  allLayouts: LayoutSummary[];
  limit: number;
}

export interface InspectLikesPaginationState {
  layoutName: string;
  likeNames: string[];
  limit: number;
}

export interface LeaderboardPaginationState {
  corpus: string;
  filter: LayoutLeaderboardFilter;
  mode: "stat" | "overall" | "awards";
  statId?: string;
  layoutCount: number;
  overallStatCount?: number;
  limit: number;
  entries: LeaderboardEntry[];
}

export interface ExamplesPaginationState {
  layoutName: string;
  stat: string;
  corpus: string;
  examples: StatExample[];
  limit: number;
}

export type PaginationSessionState =
  | LayoutsPaginationState
  | LikesPaginationState
  | InspectLikesPaginationState
  | LeaderboardPaginationState
  | ExamplesPaginationState;

export interface PaginationSessionRecord {
  id: string;
  userId: string;
  title: string;
  kind: PaginationSessionKind;
  state: PaginationSessionState;
  currentPage: number;
  createdAt: string;
  effectiveLimit?: number;
}
