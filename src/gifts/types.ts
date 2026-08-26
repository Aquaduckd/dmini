export interface PendingGift {
  layout: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  createdAt: string;
  expiresAt: string;
}

export interface GiftStore {
  gifts: PendingGift[];
}

export const GIFT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export function isGiftExpired(gift: PendingGift, now = Date.now()): boolean {
  return Date.parse(gift.expiresAt) <= now;
}

export function formatGiftExpiry(expiresAt: string): string {
  return new Date(expiresAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
