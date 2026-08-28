import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PaginationSessionRecord } from "./types.js";

export const PAGINATION_CACHE_DIR = path.resolve(
  process.cwd(),
  ".dmini/cache/pagination",
);

function sessionPath(id: string): string {
  return path.join(PAGINATION_CACHE_DIR, `${id}.json`);
}

function isExpired(record: PaginationSessionRecord, ttlMs: number): boolean {
  const createdAt = Date.parse(record.createdAt);
  if (Number.isNaN(createdAt)) return true;
  return Date.now() - createdAt >= ttlMs;
}

export async function writePaginationSession(
  record: PaginationSessionRecord,
): Promise<void> {
  await mkdir(PAGINATION_CACHE_DIR, { recursive: true });
  await writeFile(
    sessionPath(record.id),
    `${JSON.stringify(record, null, 2)}\n`,
    "utf8",
  );
}

export async function readPaginationSession(
  id: string,
  ttlMs: number,
): Promise<PaginationSessionRecord | null> {
  let raw: string;

  try {
    raw = await readFile(sessionPath(id), "utf8");
  } catch {
    return null;
  }

  try {
    const record = JSON.parse(raw) as PaginationSessionRecord;
    if (!record?.id || record.id !== id) return null;
    if (isExpired(record, ttlMs)) {
      await deletePaginationSession(id);
      return null;
    }
    return record;
  } catch {
    await deletePaginationSession(id);
    return null;
  }
}

export async function deletePaginationSession(id: string): Promise<void> {
  await rm(sessionPath(id), { force: true });
}

export async function sweepExpiredPaginationSessions(
  ttlMs: number,
): Promise<void> {
  let files: string[];

  try {
    files = await readdir(PAGINATION_CACHE_DIR);
  } catch {
    return;
  }

  await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const id = file.slice(0, -".json".length);
        await readPaginationSession(id, ttlMs);
      }),
  );
}
