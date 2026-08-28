import type { EmbedBuilder } from "discord.js";

export class LayoutLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LayoutLinkError";
  }
}

export function layoutEmbedUrl(link?: string): string | undefined {
  const trimmed = link?.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export function applyLayoutEmbedUrl(
  embed: EmbedBuilder,
  link?: string,
): EmbedBuilder {
  const url = layoutEmbedUrl(link);
  if (url) {
    embed.setURL(url);
  }
  return embed;
}

export function normalizeLayoutLink(url: string): string {
  const normalized = layoutEmbedUrl(url);
  if (!normalized) {
    throw new LayoutLinkError(
      "Invalid URL. Links must start with `http://` or `https://`.",
    );
  }
  return normalized;
}

export function layoutHasLink(link?: string): boolean {
  return layoutEmbedUrl(link) !== undefined;
}
