import type { LayoutDoc } from "./types.js";

export function isQwertyLayout(name: string): boolean {
  return name.trim().toLowerCase() === "qwerty";
}

export function layoutLikedByUser(
  layout: Pick<LayoutDoc, "likes">,
  userId: string,
): boolean {
  return (
    layout.likes?.some((id) => String(id) === String(userId)) ?? false
  );
}

export function addLayoutLike(
  layout: LayoutDoc,
  userId: string,
): { layout: LayoutDoc; added: boolean } {
  if (layoutLikedByUser(layout, userId)) {
    return { layout, added: false };
  }

  return {
    layout: { ...layout, likes: [...(layout.likes ?? []), userId] },
    added: true,
  };
}

export function removeLayoutLike(
  layout: LayoutDoc,
  userId: string,
): { layout: LayoutDoc; removed: boolean } {
  const existing = layout.likes ?? [];
  const likes = existing.filter((id) => String(id) !== String(userId));

  if (likes.length === existing.length) {
    return { layout, removed: false };
  }

  return {
    layout: { ...layout, likes },
    removed: true,
  };
}
