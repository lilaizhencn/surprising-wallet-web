export type PageResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export function emptyPage<T>(limit: number, offset: number): PageResponse<T> {
  return { items: [], total: 0, limit, offset };
}
