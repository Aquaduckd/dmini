export interface PaginationInfo {
  page: number;
  pageCount: number;
  limit: number;
  total: number;
}

export function formatPaginationFooter({
  page,
  pageCount,
  limit,
  total,
}: PaginationInfo): string {
  return `Page ${page}/${pageCount} · ${limit} per page · ${total} total`;
}
