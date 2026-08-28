import type { LayoutDoc } from "../layout/types.js";

function preserveJsonSnowflakes(raw: string): string {
  return raw
    .replace(/"user"\s*:\s*(\d{15,})/g, '"user":"$1"')
    .replace(/"likes"\s*:\s*\[([^\]]*)\]/g, (_match, inner: string) => {
      const quoted = inner.replace(/\b(\d{15,})\b/g, '"$1"');
      return `"likes":[${quoted}]`;
    })
    .replace(/"([^"\\]+)"\s*:\s*(\d{15,})/g, '"$1":"$2"');
}

function assertNumericId(value: string | number, label: string): string {
  const id = String(value).trim();
  if (!/^\d+$/.test(id)) {
    throw new Error(`${label} must be a numeric Discord id`);
  }
  return id;
}

export function parseJsonPreservingLargeInts<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return JSON.parse(preserveJsonSnowflakes(raw)) as T;
  }
}

export function parseAuthorsJson(raw: string): Record<string, string> {
  return JSON.parse(raw) as Record<string, string>;
}

export function stringifyLayoutCreate(
  layout: {
    name: string;
    board: string;
    user: string | number;
    keys: Record<string, { row: number; col: number; finger: string }>;
    magic?: LayoutDoc["magic"];
  },
): string {
  const user = assertNumericId(layout.user, "User");
  const parts = [
    `"name":${JSON.stringify(layout.name)}`,
    `"board":${JSON.stringify(layout.board)}`,
    `"user":${JSON.stringify(user)}`,
    `"keys":${JSON.stringify(layout.keys)}`,
  ];

  if (layout.magic?.length) {
    parts.push(`"magic":${JSON.stringify(layout.magic)}`);
  }

  return `{${parts.join(",")}}`;
}

export function stringifyLayoutDoc(layout: LayoutDoc): string {
  const parts = [
    `"name":${JSON.stringify(layout.name)}`,
    `"board":${JSON.stringify(layout.board)}`,
    `"keys":${JSON.stringify(layout.keys)}`,
  ];

  if (layout.user !== undefined && layout.user !== null && layout.user !== "") {
    parts.splice(
      2,
      0,
      `"user":${JSON.stringify(assertNumericId(layout.user, "User"))}`,
    );
  }

  if (layout.likes !== undefined) {
    parts.push(
      `"likes":[${layout.likes.map((id) => JSON.stringify(assertNumericId(id, "Like"))).join(",")}]`,
    );
  }

  if (layout.link) {
    parts.push(`"link":${JSON.stringify(layout.link)}`);
  }

  if (layout.magic !== undefined) {
    parts.push(`"magic":${JSON.stringify(layout.magic)}`);
  }

  return `{${parts.join(",")}}`;
}
