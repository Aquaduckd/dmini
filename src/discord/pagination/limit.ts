import { fitsInCodeBlock } from "../embeds.js";

export class PaginatedContentTooLongError extends Error {
  constructor() {
    super("Paginated content is too long for Discord.");
    this.name = "PaginatedContentTooLongError";
  }
}

export async function resolvePaginatedLimit(
  limit: number,
  buildText: (pageLimit: number) => string | Promise<string>,
  reducedLimit = Math.min(limit, 15),
): Promise<{ effectiveLimit: number; text: string }> {
  let text = await buildText(limit);
  if (fitsInCodeBlock(text)) {
    return { effectiveLimit: limit, text };
  }

  if (reducedLimit >= limit) {
    throw new PaginatedContentTooLongError();
  }

  text = await buildText(reducedLimit);
  if (!fitsInCodeBlock(text)) {
    throw new PaginatedContentTooLongError();
  }

  return { effectiveLimit: reducedLimit, text };
}
