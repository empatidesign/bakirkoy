import { test, expect } from '@playwright/test'
import { AdminApi, loginAndOpen, uniq } from './helpers/adminApi'

let api: AdminApi

test.describe('Settings menu admin CRUD coverage', () => {
  test.beforeAll(async () => { api = await AdminApi.create() })
  test.afterAll(async () => { await api.dispose() })

  test('app-menu section ve menu item CRUD yanıtlarını doğrular', async ({ page }) => {
    test.setTimeout(90000)
    const key = `e2e_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`
    const sectionTitle = uniq('E2E Menü Bölümü')
    const itemTitle = uniq('E2E Menü Item')
    const updatedTitle = `${itemTitle} Güncel`

    const section = await api.request<{ id: string; title: string }>('POST', '/app-menu/sections', {
      key,
      title: sectionTitle,
      icon: 'Settings',
      isVisible: true,
      showInSidebar: true,
      showInMobile: false,
    })
    expect(section.title).toBe(sectionTitle)

    const item = await api.request<{ id: string; title: string }>('POST', '/app-menu/items', {
      sectionId: section.id,
      moduleKey: '',
      title: itemTitle,
      icon: 'Settings',
      iconType: 0,
      color: '#2563eb',
      linkType: 1,
      linkTarget: '/e2e-menu',
      mobileLinkTarget: '',
      showInSidebar: true,
      showInMobile: false,
      isPopular: false,
      isVisible: true,
      requiresAuth: false,
      badgeText: '',
      badgeTone: '',
    })
    expect(item.title).toBe(itemTitle)

    const updated = await api.request<{ title: string }>('PUT', `/app-menu/items/${item.id}`, {
      sectionId: section.id,
      moduleKey: '',
      title: updatedTitle,
      icon: 'Settings',
      iconType: 0,
      color: '#16a34a',
      linkType: 1,
      linkTarget: '/e2e-menu-updated',
      mobileLinkTarget: '',
      showInSidebar: true,
      showInMobile: false,
      isPopular: true,
      isVisible: true,
      requiresAuth: false,
      badgeText: 'E2E',
      badgeTone: 'success',
    })
    expect(updated.title).toBe(updatedTitle)

    const sections = await api.request<{ id: string; title: string; items: { title: string }[] }[]>('GET', '/app-menu/sections')
    const savedSection = sections.find((s) => s.id === section.id)
    expect(savedSection?.title).toBe(sectionTitle)
    expect(savedSection?.items.some((i) => i.title === updatedTitle)).toBeTruthy()

    await loginAndOpen(page, '/settings?tab=menu-management', 'Menü Yönetimi')
    await expect(page.getByText('Menü Yönetimi').first()).toBeVisible({ timeout: 20000 })
  })
})
