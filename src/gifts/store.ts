import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  GIFT_EXPIRY_MS,
  isGiftExpired,
  type GiftStore,
  type PendingGift,
} from "./types.js";

const GIFTS_PATH = path.resolve(process.cwd(), ".dmini/gifts.json");

async function loadStore(): Promise<GiftStore> {
  try {
    const raw = await readFile(GIFTS_PATH, "utf8");
    return JSON.parse(raw) as GiftStore;
  } catch {
    return { gifts: [] };
  }
}

async function saveStore(store: GiftStore): Promise<void> {
  await mkdir(path.dirname(GIFTS_PATH), { recursive: true });
  await writeFile(GIFTS_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function purgeExpired(store: GiftStore): PendingGift[] {
  const active = store.gifts.filter((gift) => !isGiftExpired(gift));
  store.gifts = active;
  return active;
}

export async function listActiveGifts(): Promise<PendingGift[]> {
  const store = await loadStore();
  return purgeExpired(store);
}

export async function findPendingGiftForLayout(
  layoutName: string,
): Promise<PendingGift | undefined> {
  const store = await loadStore();
  const before = store.gifts.length;
  purgeExpired(store);
  if (store.gifts.length !== before) {
    await saveStore(store);
  }

  const normalized = layoutName.trim().toLowerCase();
  return store.gifts.find((gift) => gift.layout.toLowerCase() === normalized);
}

export async function findPendingGiftsFromSender(
  toUserId: string,
  fromUsername: string,
): Promise<PendingGift[]> {
  const store = await loadStore();
  const before = store.gifts.length;
  purgeExpired(store);
  if (store.gifts.length !== before) {
    await saveStore(store);
  }

  const sender = fromUsername.trim().toLowerCase();
  return store.gifts.filter(
    (gift) =>
      gift.toUserId === String(toUserId) &&
      gift.fromUsername.toLowerCase() === sender,
  );
}

export async function createPendingGift(input: {
  layout: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
}): Promise<PendingGift> {
  const store = await loadStore();
  purgeExpired(store);

  const existing = store.gifts.find(
    (gift) => gift.layout.toLowerCase() === input.layout.toLowerCase(),
  );
  if (existing) {
    throw new GiftStoreError(
      `Layout \`${input.layout}\` already has a pending gift offer.`,
    );
  }

  const now = new Date();
  const gift: PendingGift = {
    layout: input.layout,
    fromUserId: String(input.fromUserId),
    fromUsername: input.fromUsername,
    toUserId: String(input.toUserId),
    toUsername: input.toUsername,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + GIFT_EXPIRY_MS).toISOString(),
  };

  store.gifts.push(gift);
  await saveStore(store);
  return gift;
}

export async function removePendingGift(
  layoutName: string,
  toUserId: string,
  fromUserId: string,
): Promise<boolean> {
  const store = await loadStore();
  const before = store.gifts.length;
  store.gifts = store.gifts.filter(
    (gift) =>
      !(
        gift.layout.toLowerCase() === layoutName.toLowerCase() &&
        gift.toUserId === String(toUserId) &&
        gift.fromUserId === String(fromUserId)
      ),
  );

  if (store.gifts.length === before) return false;

  await saveStore(store);
  return true;
}

export class GiftStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GiftStoreError";
  }
}
