import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_FINGER_PALETTE,
  type FingermapPaletteId,
} from "../render/fingermap.js";
import { resolveDownloadedCorpus } from "../mana2/corpus.js";

export type RenderMode = "fingermap" | "heatmap";

export interface UserSettings {
  corpus?: string;
  render?: RenderMode;
  fingermapPalette?: FingermapPaletteId;
}

export const DEFAULT_RENDER_MODE: RenderMode = "fingermap";

interface UserConfigStore {
  users: Record<string, UserSettings>;
}

const CONFIG_DIR = path.resolve(process.cwd(), ".dmini");
const CONFIG_PATH = path.join(CONFIG_DIR, "user-config.json");

export const BOT_DEFAULT_CORPUS =
  process.env.MANA2_CORPUS?.trim() || "monkeyracer";

let storeCache: UserConfigStore | null = null;

async function loadStore(): Promise<UserConfigStore> {
  if (storeCache) return storeCache;

  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    storeCache = JSON.parse(raw) as UserConfigStore;
    return storeCache;
  } catch {
    storeCache = { users: {} };
    return storeCache;
  }
}

async function saveStore(store: UserConfigStore): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  storeCache = store;
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const store = await loadStore();
  return store.users[userId] ?? {};
}

export async function setUserCorpus(
  userId: string,
  corpus: string,
): Promise<UserSettings> {
  const store = await loadStore();
  const settings = { ...(store.users[userId] ?? {}), corpus };
  store.users[userId] = settings;
  await saveStore(store);
  return settings;
}

export async function setUserRenderMode(
  userId: string,
  render: RenderMode,
): Promise<UserSettings> {
  const store = await loadStore();
  const settings = { ...(store.users[userId] ?? {}), render };
  store.users[userId] = settings;
  await saveStore(store);
  return settings;
}

export async function setUserFingermapPalette(
  userId: string,
  fingermapPalette: FingermapPaletteId,
): Promise<UserSettings> {
  const store = await loadStore();
  const settings = { ...(store.users[userId] ?? {}), fingermapPalette };
  store.users[userId] = settings;
  await saveStore(store);
  return settings;
}

export async function resolveRenderMode(
  userId: string,
  override?: RenderMode,
): Promise<RenderMode> {
  if (override) return override;

  const settings = await getUserSettings(userId);
  return settings.render ?? DEFAULT_RENDER_MODE;
}

export async function resolveFingermapPalette(
  userId: string,
): Promise<FingermapPaletteId> {
  const settings = await getUserSettings(userId);
  return settings.fingermapPalette ?? DEFAULT_FINGER_PALETTE;
}

export async function resetUserSettings(userId: string): Promise<void> {
  const store = await loadStore();
  delete store.users[userId];
  await saveStore(store);
}

export async function resolveCorpus(
  userId: string,
  override?: string,
): Promise<string> {
  if (override?.trim()) {
    return resolveDownloadedCorpus(override);
  }

  const settings = await getUserSettings(userId);
  if (settings.corpus?.trim()) {
    return resolveDownloadedCorpus(settings.corpus);
  }

  return resolveDownloadedCorpus(BOT_DEFAULT_CORPUS);
}
