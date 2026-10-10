import type { PagedResult } from '@/types/common'

export interface AllPagesResult<T> {
  items: T[]
  total: number
  complete: boolean
  error: boolean
}

const DEFAULT_MAX_PAGES = 20

export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<PagedResult<T>>,
  maxPages: number = DEFAULT_MAX_PAGES,
): Promise<AllPagesResult<T>> {
  const first = await fetchPage(1)
  const items = [...first.items]
  const total = first.total
  let page = 2
  while (items.length < total && page <= first.totalPages && page <= maxPages) {
    let next: PagedResult<T>
    try {
      next = await fetchPage(page)
    } catch {
      return { items, total, complete: false, error: true }
    }
    if (next.items.length === 0) break
    items.push(...next.items)
    page += 1
  }
  return { items, total, complete: items.length >= total, error: false }
}
