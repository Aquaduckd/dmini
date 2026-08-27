import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface AccessLockFile {
  locked: boolean;
}

const ACCESS_LOCK_PATH = path.resolve(process.cwd(), ".dmini/access-lock.json");

async function readAccessLock(): Promise<AccessLockFile> {
  try {
    const raw = await readFile(ACCESS_LOCK_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AccessLockFile>;
    return { locked: parsed.locked === true };
  } catch {
    return { locked: false };
  }
}

async function writeAccessLock(locked: boolean): Promise<void> {
  await mkdir(path.dirname(ACCESS_LOCK_PATH), { recursive: true });
  await writeFile(
    ACCESS_LOCK_PATH,
    `${JSON.stringify({ locked }, null, 2)}\n`,
    "utf8",
  );
}

export async function isPublicAccessBlocked(): Promise<boolean> {
  const state = await readAccessLock();
  return state.locked;
}

export async function togglePublicAccessBlocked(): Promise<boolean> {
  const state = await readAccessLock();
  const locked = !state.locked;
  await writeAccessLock(locked);
  return locked;
}
