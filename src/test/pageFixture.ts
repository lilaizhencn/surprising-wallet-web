import type { PageResponse } from '../types/pagination';

export function pageFixture<T>(items: T[], request: string): PageResponse<T> {
  const query = new URL(request, 'http://wallet.test').searchParams;
  const limit = Number(query.get('limit') ?? 20);
  const offset = Number(query.get('offset') ?? 0);
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
}
