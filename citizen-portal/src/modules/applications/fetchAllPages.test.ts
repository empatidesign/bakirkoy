import { describe, it, expect, vi } from 'vitest'
import { fetchAllPages } from './fetchAllPages'
import type { PagedResult } from '@/types/common'

const makePager = (total: number, limit: number) =>
  vi.fn(async (page: number): Promise<PagedResult<number>> => {
    const start = (page - 1) * limit
    const items = Array.from({ length: Math.max(0, Math.min(limit, total - start)) }, (_, i) => start + i)
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
  })

describe('fetchAllPages — birleşik başvuru sayfalama (R06)', () => {
  it('21 kayıtta 20-limitli 2 sayfayı çeker, 21. kayda ulaşılır, complete=true', async () => {
    const pager = makePager(21, 20)
    const r = await fetchAllPages(pager, 20)
    expect(r.items).toHaveLength(21)
    expect(r.items).toContain(20)
    expect(r.complete).toBe(true)
    expect(pager).toHaveBeenCalledTimes(2)
  })

  it('51 kayıtta 50-limitli iki sayfa çekilir, 51. kayda ulaşılır', async () => {
    const pager = makePager(51, 50)
    const r = await fetchAllPages(pager, 20)
    expect(r.items).toHaveLength(51)
    expect(r.items).toContain(50)
    expect(r.complete).toBe(true)
  })

  it('maxPages sınırı aşılırsa complete=false (kısmi liste işaretlenir)', async () => {
    const pager = makePager(1000, 50)
    const r = await fetchAllPages(pager, 2)
    expect(r.items).toHaveLength(100)
    expect(r.complete).toBe(false)
  })

  it('tek sayfa yeterliyse ikinci istek yapılmaz', async () => {
    const pager = makePager(10, 50)
    const r = await fetchAllPages(pager, 20)
    expect(r.items).toHaveLength(10)
    expect(r.complete).toBe(true)
    expect(r.error).toBe(false)
    expect(pager).toHaveBeenCalledTimes(1)
  })

  it('R06: 1. sayfa başarılı, 2. sayfa hata → biriken kayıtlar KORUNUR + error=true', async () => {
    const pager = vi.fn(async (page: number) => {
      if (page === 1) return { items: Array.from({ length: 50 }, (_, i) => i), total: 500, page: 1, limit: 50, totalPages: 10 }
      throw new Error('page 2 failed')
    })
    const r = await fetchAllPages(pager, 20)
    expect(r.items).toHaveLength(50)
    expect(r.complete).toBe(false)
    expect(r.error).toBe(true)
  })

  it('R06: 1. sayfa hatası reddederek yayılır (gerçek kaynak hatası)', async () => {
    const pager = vi.fn(async () => { throw new Error('page 1 failed') })
    await expect(fetchAllPages(pager, 20)).rejects.toThrow()
  })
})
