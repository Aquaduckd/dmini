import { LAYOUT_API_BASE } from "./client.js";
import { LayoutApiError } from "./layouts.js";

export interface LayoutApiMeta {
  layout_count: number;
  author_count: number;
}

export async function fetchLayoutApiMeta(): Promise<LayoutApiMeta> {
  const response = await fetch(`${LAYOUT_API_BASE}/meta`);

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

  const body = (await response.json()) as Partial<LayoutApiMeta>;
  return {
    layout_count: body.layout_count ?? 0,
    author_count: body.author_count ?? 0,
  };
}
