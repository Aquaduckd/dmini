import { LAYOUT_API_BASE } from "./client.js";
import { parseAuthorsJson } from "./json.js";
import { LayoutApiError } from "./layouts.js";

const AUTHORS_URL = `${LAYOUT_API_BASE}/authors`;

let authorsByNameCache: Record<string, string> | null = null;
let authorsPromise: Promise<Record<string, string>> | null = null;

async function fetchAuthorsByName(): Promise<Record<string, string>> {
  const response = await fetch(AUTHORS_URL);

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep statusText
    }
    throw new LayoutApiError(response.status, message);
  }

  return parseAuthorsJson(await response.text());
}

export async function loadAuthorsByName(): Promise<Record<string, string>> {
  if (authorsByNameCache) return authorsByNameCache;

  authorsPromise ??= fetchAuthorsByName().then((authors) => {
    authorsByNameCache = authors;
    return authors;
  });

  return authorsPromise;
}

async function loadAuthorIdMap(): Promise<Map<string, string>> {
  const authors = await loadAuthorsByName();
  const byId = new Map<string, string>();

  for (const [name, id] of Object.entries(authors)) {
    byId.set(String(id), name);
  }

  return byId;
}

export async function resolveLayoutAuthor(
  user?: string | number,
): Promise<string | undefined> {
  if (user === undefined || user === null || user === "") return undefined;

  try {
    const map = await loadAuthorIdMap();
    return map.get(String(user));
  } catch (error) {
    console.warn("Failed to resolve layout author:", error);
    return undefined;
  }
}

export async function resolveAuthorUserId(
  query: string,
): Promise<{ id: string; name: string } | null> {
  const authors = await loadAuthorsByName();
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  for (const [name, id] of Object.entries(authors)) {
    if (name.toLowerCase() === normalized) {
      return { id: String(id), name };
    }
  }

  return null;
}

export async function resolveAuthorNameByUserId(
  userId: string,
): Promise<string | undefined> {
  return resolveLayoutAuthor(userId);
}
