import { parse as parseJsonc } from "jsonc-parser";
import { readFile } from "node:fs/promises";
import path from "node:path";

interface AdminConfigFile {
  admins?: Array<string | number>;
}

const ADMINS_PATH = path.resolve(process.cwd(), ".dmini/admins.jsonc");

async function loadAdmins(): Promise<string[]> {
  try {
    const raw = await readFile(ADMINS_PATH, "utf8");
    const data = parseJsonc(raw) as AdminConfigFile;
    return (data.admins ?? []).map((id) => String(id));
  } catch {
    return [];
  }
}

export async function getAdminIds(): Promise<string[]> {
  return loadAdmins();
}

export async function isAdmin(userId: string): Promise<boolean> {
  const admins = await getAdminIds();
  return admins.includes(String(userId));
}
