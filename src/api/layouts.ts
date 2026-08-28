import type { LayoutDoc } from "../layout/types.js";
import { layoutApiAuthHeaders, LAYOUT_API_BASE } from "./client.js";
import {
  parseJsonPreservingLargeInts,
  stringifyLayoutCreate,
  stringifyLayoutDoc,
} from "./json.js";
import {
  formatLayoutNotFoundMessage,
  suggestLayouts,
} from "./layoutSuggest.js";

const BASE_URL = `${LAYOUT_API_BASE}/layouts`;

export class LayoutApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "LayoutApiError";
  }
}

export class LayoutNotFoundError extends LayoutApiError {
  constructor(
    public readonly query: string,
    public readonly suggestions: string[],
  ) {
    super(404, formatLayoutNotFoundMessage(query, suggestions));
    this.name = "LayoutNotFoundError";
  }

  formatMessage(): string {
    return this.message;
  }
}

export class LayoutAlreadyExistsError extends LayoutApiError {
  constructor(public readonly name: string) {
    super(409, `Layout \`${name}\` already exists.`);
    this.name = "LayoutAlreadyExistsError";
  }
}

export function formatWriteApiError(error: LayoutApiError): string {
  if (error instanceof LayoutAlreadyExistsError) {
    return error.message;
  }

  switch (error.status) {
    case 401:
      return "Write access denied. Check that `LAYOUTAPI_TOKEN` matches an entry in the server's `apps.json`.";
    case 503:
      return "Layout writes are disabled on the server (no app tokens configured).";
    case 403:
      return error.message || "You don't have permission to write this layout.";
    case 409:
      return error.message || "That layout already exists.";
    default:
      return error.message || `Request failed (${error.status}).`;
  }
}

async function fetchLayoutResponse(name: string): Promise<Response> {
  const url = `${BASE_URL}/${encodeURIComponent(name.trim())}`;
  return fetch(url);
}

async function parseLayoutError(response: Response): Promise<string> {
  let message = response.statusText;
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // keep statusText
  }
  return message;
}

export async function fetchLayout(name: string): Promise<string> {
  const trimmed = name.trim();
  const response = await fetchLayoutResponse(trimmed);

  if (!response.ok) {
    if (response.status === 404) {
      const suggestions = await suggestLayouts(trimmed);
      throw new LayoutNotFoundError(trimmed, suggestions);
    }

    throw new LayoutApiError(response.status, await parseLayoutError(response));
  }

  return response.text();
}

function parseLayoutDocJson(raw: string): LayoutDoc {
  return parseJsonPreservingLargeInts<LayoutDoc>(raw);
}

export async function fetchLayoutDoc(name: string): Promise<LayoutDoc> {
  const raw = await fetchLayout(name);
  return parseLayoutDocJson(raw);
}

export interface LayoutSummary {
  id: string;
  name: string;
  user: string;
  board: string;
  tag?: string;
  key_count?: number;
  like_count?: number;
  has_magic?: boolean;
  has_combos?: boolean;
  has_thumbs?: boolean;
  created_at?: string;
  modified_at?: string;
}

export interface LayoutListResponse {
  total: number;
  layouts: LayoutSummary[];
}

export async function listLayouts(
  options: {
    user?: string;
    likedBy?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<LayoutListResponse> {
  const params = new URLSearchParams();

  if (options.user) params.set("user", options.user);
  if (options.likedBy) params.set("liked_by", options.likedBy);
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.offset !== undefined) params.set("offset", String(options.offset));

  const query = params.toString();
  const url = query ? `${BASE_URL}?${query}` : BASE_URL;
  const response = await fetch(url);

  if (!response.ok) {
    throw new LayoutApiError(response.status, await parseLayoutError(response));
  }

  return parseJsonPreservingLargeInts<LayoutListResponse>(await response.text());
}

export async function listAllLayouts(
  options: { user?: string } = {},
): Promise<LayoutSummary[]> {
  const { layouts } = await listLayouts(options.user ? { user: options.user } : {});
  return layouts;
}

export async function createLayout(
  layout: Pick<LayoutDoc, "name" | "board" | "keys"> & {
    user: string | number;
    magic?: LayoutDoc["magic"];
  },
): Promise<LayoutDoc> {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: layoutApiAuthHeaders(),
    body: stringifyLayoutCreate(layout),
  });

  if (response.status === 409) {
    throw new LayoutAlreadyExistsError(layout.name);
  }

  if (!response.ok) {
    throw new LayoutApiError(response.status, await parseLayoutError(response));
  }

  return parseLayoutDocJson(await response.text());
}

export async function updateLayout(layout: LayoutDoc): Promise<LayoutDoc> {
  const response = await fetch(
    `${BASE_URL}/${encodeURIComponent(layout.name.trim())}`,
    {
      method: "PUT",
      headers: layoutApiAuthHeaders(),
      body: stringifyLayoutDoc(layout),
    },
  );

  if (response.status === 404) {
    const suggestions = await suggestLayouts(layout.name);
    throw new LayoutNotFoundError(layout.name, suggestions);
  }

  if (!response.ok) {
    throw new LayoutApiError(response.status, await parseLayoutError(response));
  }

  const raw = await response.text();
  return raw ? parseLayoutDocJson(raw) : layout;
}

export async function renameLayout(
  oldName: string,
  newName: string,
): Promise<LayoutDoc> {
  const response = await fetch(
    `${BASE_URL}/${encodeURIComponent(oldName.trim())}/rename`,
    {
      method: "POST",
      headers: layoutApiAuthHeaders(),
      body: JSON.stringify({ name: newName }),
    },
  );

  if (response.status === 404) {
    const suggestions = await suggestLayouts(oldName);
    throw new LayoutNotFoundError(oldName, suggestions);
  }

  if (response.status === 409) {
    throw new LayoutAlreadyExistsError(newName);
  }

  if (!response.ok) {
    throw new LayoutApiError(response.status, await parseLayoutError(response));
  }

  return parseLayoutDocJson(await response.text());
}

export async function deleteLayout(name: string): Promise<void> {
  const trimmed = name.trim();
  const response = await fetch(
    `${BASE_URL}/${encodeURIComponent(trimmed)}`,
    {
      method: "DELETE",
      headers: layoutApiAuthHeaders(),
    },
  );

  if (response.status === 404) {
    const suggestions = await suggestLayouts(trimmed);
    throw new LayoutNotFoundError(trimmed, suggestions);
  }

  if (!response.ok) {
    throw new LayoutApiError(response.status, await parseLayoutError(response));
  }
}
