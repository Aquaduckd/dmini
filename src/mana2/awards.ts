import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { listAllLayouts } from "../api/layouts.js";
import { ANALYZER_VERSION } from "./cache.js";
import { sanitizeTempName } from "./cli.js";
import { resolveDownloadedCorpus } from "./corpus.js";

export const CROWN = "👑";
export const OVERALL_TIER = "🃏";
export const LIKES_TIER = "❤️";
export const LIKES_TIER_MIN = 5;
export const MAGIC_BADGE = "✨";
export const THUMB_BADGE = "👍";

export const AWARD_STAT_IDS = [
  "sfb",
  "sfs",
  "lsb",
  "vsb",
  "roll",
  "redirect",
  "alt",
] as const;

export type AwardStatId = (typeof AWARD_STAT_IDS)[number];
export type AwardBoardId = "overall" | AwardStatId;

export const STAT_AWARD_EMOJI: Record<AwardStatId, string> = {
  sfb: "🐏",
  sfs: "🦘",
  lsb: "🦀",
  vsb: "✂️",
  roll: "🎲",
  redirect: "🪃",
  alt: "🏓",
};

export const TOP_AWARD_COUNT = 200;

const AWARD_STAT_ID_SET = new Set<string>(AWARD_STAT_IDS);

const AWARDS_CACHE_DIR = path.resolve(process.cwd(), ".dmini", "cache", "awards");

export interface BoardAward {
  crown?: string;
  tier: string[];
  awarded_at: string;
}

export interface CorpusAwards {
  corpus: string;
  analyzer_version: number;
  overall?: BoardAward;
  stats: Partial<Record<AwardStatId, BoardAward>>;
}

export interface LikesAwards {
  analyzer_version: number;
  likes?: BoardAward;
}

function awardsCachePath(corpus: string): string {
  return path.join(AWARDS_CACHE_DIR, `${sanitizeTempName(corpus)}.json`);
}

const LIKES_AWARDS_PATH = path.join(AWARDS_CACHE_DIR, "likes.json");

function layoutNamesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function isLegacyAwardsFormat(parsed: Record<string, unknown>): boolean {
  return "filters" in parsed && !("stats" in parsed);
}

async function readCorpusAwards(corpus: string): Promise<CorpusAwards | null> {
  try {
    const raw = await readFile(awardsCachePath(corpus), "utf8");
    const parsed = JSON.parse(raw) as CorpusAwards & Record<string, unknown>;
    if (parsed.analyzer_version !== ANALYZER_VERSION) {
      return null;
    }
    if (isLegacyAwardsFormat(parsed)) {
      return null;
    }
    return {
      corpus: parsed.corpus,
      analyzer_version: parsed.analyzer_version,
      overall: parsed.overall,
      stats: parsed.stats ?? {},
    };
  } catch {
    return null;
  }
}

export function isAwardStatId(statId: string): statId is AwardStatId {
  return AWARD_STAT_ID_SET.has(statId);
}

export async function loadCorpusAwards(corpus: string): Promise<CorpusAwards | null> {
  const resolvedCorpus = await resolveDownloadedCorpus(corpus);
  return readCorpusAwards(resolvedCorpus);
}

async function readLikesAwards(): Promise<LikesAwards | null> {
  try {
    const raw = await readFile(LIKES_AWARDS_PATH, "utf8");
    const parsed = JSON.parse(raw) as LikesAwards;
    if (parsed.analyzer_version !== ANALYZER_VERSION) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function loadLikesAwards(): Promise<LikesAwards | null> {
  return readLikesAwards();
}

export async function buildLikesAwardData(): Promise<{
  tierLayouts: string[];
  crownLayout?: string;
}> {
  const layouts = await listAllLayouts();
  const ranked = [...layouts].sort((a, b) => {
    const diff = (b.like_count ?? 0) - (a.like_count ?? 0);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });

  const tierLayouts = ranked
    .filter((layout) => (layout.like_count ?? 0) >= LIKES_TIER_MIN)
    .map((layout) => layout.name);

  return {
    crownLayout: ranked[0]?.name,
    tierLayouts,
  };
}

export async function refreshLikesAwards(
  tierLayouts: string[],
  crownLayout?: string,
): Promise<void> {
  const likesAward: BoardAward = {
    tier: tierLayouts,
    awarded_at: new Date().toISOString(),
  };
  if (crownLayout) {
    likesAward.crown = crownLayout;
  }

  const awards: LikesAwards = {
    analyzer_version: ANALYZER_VERSION,
    likes: likesAward,
  };

  await mkdir(AWARDS_CACHE_DIR, { recursive: true });
  await writeFile(LIKES_AWARDS_PATH, `${JSON.stringify(awards, null, 2)}\n`, "utf8");
}

export async function refreshBoardAwards(
  corpus: string,
  board: AwardBoardId,
  tierLayouts: string[],
  crownLayout?: string,
): Promise<void> {
  const resolvedCorpus = await resolveDownloadedCorpus(corpus);
  const existing =
    (await readCorpusAwards(resolvedCorpus)) ?? {
      corpus: resolvedCorpus,
      analyzer_version: ANALYZER_VERSION,
      stats: {},
    };

  const boardAward: BoardAward = {
    tier: tierLayouts.slice(0, TOP_AWARD_COUNT),
    awarded_at: new Date().toISOString(),
  };
  if (crownLayout) {
    boardAward.crown = crownLayout;
  }

  existing.corpus = resolvedCorpus;
  existing.analyzer_version = ANALYZER_VERSION;

  if (board === "overall") {
    existing.overall = boardAward;
  } else {
    existing.stats[board] = boardAward;
  }

  await mkdir(AWARDS_CACHE_DIR, { recursive: true });
  await writeFile(
    awardsCachePath(resolvedCorpus),
    `${JSON.stringify(existing, null, 2)}\n`,
    "utf8",
  );
}

function getBoardAward(
  awards: CorpusAwards,
  board: AwardBoardId,
): BoardAward | undefined {
  return board === "overall" ? awards.overall : awards.stats[board];
}

export function layoutHoldsBoardCrown(
  layoutName: string,
  board: AwardBoardId,
  awards: CorpusAwards,
): boolean {
  const boardAward = getBoardAward(awards, board);
  return Boolean(
    boardAward?.crown && layoutNamesMatch(boardAward.crown, layoutName),
  );
}

export function layoutInBoardTier(
  layoutName: string,
  board: AwardBoardId,
  awards: CorpusAwards,
): boolean {
  const boardAward = getBoardAward(awards, board);
  return (
    boardAward?.tier.some((name) => layoutNamesMatch(name, layoutName)) ?? false
  );
}

export function layoutHoldsLikesCrown(
  layoutName: string,
  likesAwards: LikesAwards,
): boolean {
  const crown = likesAwards.likes?.crown;
  return Boolean(crown && layoutNamesMatch(crown, layoutName));
}

export function layoutInLikesTier(
  layoutName: string,
  likesAwards: LikesAwards,
): boolean {
  return (
    likesAwards.likes?.tier.some((name) => layoutNamesMatch(name, layoutName)) ??
    false
  );
}

export function layoutHoldsAnyCrown(
  layoutName: string,
  awards: CorpusAwards | null,
  likesAwards?: LikesAwards | null,
): boolean {
  if (likesAwards && layoutHoldsLikesCrown(layoutName, likesAwards)) {
    return true;
  }
  if (!awards) return false;

  if (awards.overall?.crown && layoutNamesMatch(awards.overall.crown, layoutName)) {
    return true;
  }

  return AWARD_STAT_IDS.some((statId) =>
    layoutHoldsBoardCrown(layoutName, statId, awards),
  );
}

export function tierEmojiForBoard(board: AwardBoardId): string {
  return board === "overall" ? OVERALL_TIER : STAT_AWARD_EMOJI[board];
}

export function formatLikesRowBadges(
  layoutName: string,
  likesAwards: LikesAwards | null,
): string {
  if (!likesAwards) return "";

  const badges: string[] = [];
  if (layoutHoldsLikesCrown(layoutName, likesAwards)) {
    badges.push(CROWN);
  }
  if (layoutInLikesTier(layoutName, likesAwards)) {
    badges.push(LIKES_TIER);
  }

  return badges.length > 0 ? ` ${badges.join(" ")}` : "";
}

export function formatLeaderboardRowBadges(
  layoutName: string,
  board: AwardBoardId,
  awards: CorpusAwards | null,
): string {
  if (!awards) return "";

  const badges: string[] = [];
  if (layoutHoldsBoardCrown(layoutName, board, awards)) {
    badges.push(CROWN);
  }
  if (layoutInBoardTier(layoutName, board, awards)) {
    badges.push(tierEmojiForBoard(board));
  }

  return badges.length > 0 ? ` ${badges.join(" ")}` : "";
}

export function formatLayoutPropertyBadges(options: {
  hasMagic: boolean;
  hasThumbs: boolean;
}): string {
  const badges: string[] = [];
  if (options.hasMagic) {
    badges.push(MAGIC_BADGE);
  }
  if (options.hasThumbs) {
    badges.push(THUMB_BADGE);
  }
  return badges.join(" ");
}

export function collectLayoutAwardBadges(
  layoutName: string,
  awards: CorpusAwards | null,
  options?: {
    likesAwards?: LikesAwards | null;
    hasMagic?: boolean;
    hasThumbs?: boolean;
  },
): string[] {
  const badges: string[] = [];

  if (layoutHoldsAnyCrown(layoutName, awards, options?.likesAwards)) {
    badges.push(CROWN);
  }
  if (awards?.overall && layoutInBoardTier(layoutName, "overall", awards)) {
    badges.push(OVERALL_TIER);
  }
  for (const statId of AWARD_STAT_IDS) {
    if (awards && layoutInBoardTier(layoutName, statId, awards)) {
      badges.push(STAT_AWARD_EMOJI[statId]);
    }
  }
  if (options?.likesAwards && layoutInLikesTier(layoutName, options.likesAwards)) {
    badges.push(LIKES_TIER);
  }
  if (options?.hasMagic) {
    badges.push(MAGIC_BADGE);
  }
  if (options?.hasThumbs) {
    badges.push(THUMB_BADGE);
  }

  return badges;
}

export interface AwardsLeaderboardEntry {
  name: string;
  count: number;
  badges: string;
}

function addAwardedLayoutNames(
  names: Map<string, string>,
  layouts: string[] | undefined,
): void {
  for (const name of layouts ?? []) {
    const key = name.trim().toLowerCase();
    if (!names.has(key)) {
      names.set(key, name);
    }
  }
}

function collectAwardedLayoutNames(
  corpusAwards: CorpusAwards | null,
  likesAwards: LikesAwards | null,
): string[] {
  const names = new Map<string, string>();

  if (corpusAwards?.overall) {
    if (corpusAwards.overall.crown) {
      addAwardedLayoutNames(names, [corpusAwards.overall.crown]);
    }
    addAwardedLayoutNames(names, corpusAwards.overall.tier);
  }

  for (const statId of AWARD_STAT_IDS) {
    const board = corpusAwards?.stats[statId];
    if (board?.crown) {
      addAwardedLayoutNames(names, [board.crown]);
    }
    addAwardedLayoutNames(names, board?.tier);
  }

  if (likesAwards?.likes?.crown) {
    addAwardedLayoutNames(names, [likesAwards.likes.crown]);
  }
  addAwardedLayoutNames(names, likesAwards?.likes?.tier);

  return [...names.values()];
}

export async function buildAwardsLeaderboard(options: {
  corpus: string;
  layoutMetadata?: Map<string, { hasMagic: boolean; hasThumbs: boolean }>;
}): Promise<{
  corpus: string;
  entries: AwardsLeaderboardEntry[];
}> {
  const [corpusAwards, likesAwards] = await Promise.all([
    loadCorpusAwards(options.corpus),
    loadLikesAwards(),
  ]);

  const layoutNames = collectAwardedLayoutNames(corpusAwards, likesAwards);
  const entries: AwardsLeaderboardEntry[] = [];

  for (const name of layoutNames) {
    const metadata = options.layoutMetadata?.get(name.trim().toLowerCase());
    const badges = collectLayoutAwardBadges(name, corpusAwards, {
      likesAwards,
      hasMagic: metadata?.hasMagic,
      hasThumbs: metadata?.hasThumbs,
    });
    if (badges.length === 0) continue;

    entries.push({
      name,
      count: badges.length,
      badges: badges.join(" "),
    });
  }

  entries.sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );

  return {
    corpus: corpusAwards?.corpus ?? options.corpus,
    entries,
  };
}

export function formatLayoutAwardBadges(
  layoutName: string,
  awards: CorpusAwards | null,
  options?: {
    likesAwards?: LikesAwards | null;
    hasMagic?: boolean;
    hasThumbs?: boolean;
  },
): string {
  return collectLayoutAwardBadges(layoutName, awards, options).join(" ");
}
