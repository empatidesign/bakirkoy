#!/usr/bin/env node
/**
 * Route discovery (QA gap #21-22) + Screen Coverage report (QA gap #23-24) — 2026-09-04.
 * admin-panel varyantı — citizen-portal'daki `discoverRoutes.mjs` ile aynı prensip,
 * ama admin-panel'in route'ları `<RequirePermission permission="...">` ile sarmalı
 * olduğu için ekstra olarak her route'un gerektirdiği permission'ı da çıkarır
 * (bu veri ayrıca `permissionMatrix.spec.ts` — gap #6 — tarafından da kullanılabilir).
 *
 * Kullanım: `node tests/discovery/discoverRoutes.mjs`
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..') // admin-panel/
const APP_TSX = join(ROOT, 'src', 'App.tsx')
const TESTS_DIR = join(ROOT, 'tests', 'e2e')
const OUT_DIR = join(ROOT, 'test-artifacts')

/**
 * `src/App.tsx`'ten `<Route path="...">` tanımlarını statik olarak çıkarır.
 * admin-panel'de route element'i genelde `<RequirePermission permission="X">`
 * ile sarmalı — o durumda hem permission adını hem gerçek sayfa component'ini
 * yakalar.
 */
function extractRoutes(appTsxPath) {
  const source = readFileSync(appTsxPath, 'utf-8')
  // element={...} içeriğini, iç içe JSX olsa bile (RequirePermission sarmalayıcısı
  // gibi) doğru şekilde yakalamak için basit bir "dengeli parantez" tarayıcısı
  // kullanılıyor — normal regex greedy/non-greedy ile nested `{}` içeren JSX'i
  // güvenilir ayrıştıramaz.
  const routes = new Map()
  const routeStartRegex = /<Route\s+path="([^"]+)"\s+element=\{/g
  let match
  while ((match = routeStartRegex.exec(source)) !== null) {
    const path = match[1]
    const contentStart = match.index + match[0].length
    let depth = 1
    let i = contentStart
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') depth--
      i++
    }
    const elementJsx = source.slice(contentStart, i - 1)

    if (path === '*' || path.includes('/*')) continue
    const isRedirect = /<(Navigate|DefaultRedirect)\b/.test(elementJsx)
    const permMatch = elementJsx.match(/permission="([^"]+)"/)
    routes.set(path, { isRedirect, permission: permMatch ? permMatch[1] : null })
  }
  return routes
}

function findSpecFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === 'artifacts' || entry === '.auth') continue
      results.push(...findSpecFiles(full))
    } else if (entry.endsWith('.spec.ts')) {
      results.push(full)
    }
  }
  return results
}

function routeReferencedInSpecs(route, specContents) {
  const staticPrefix = route.replace(/:[^/]+.*$/, '')
  const needle = staticPrefix.length > 1 ? staticPrefix : route
  return specContents.some((content) => content.includes(needle))
}

function main() {
  const routeMap = extractRoutes(APP_TSX)
  const routes = [...routeMap.keys()].sort()
  const specFiles = findSpecFiles(TESTS_DIR)
  const specContents = specFiles.map((f) => readFileSync(f, 'utf-8'))

  const results = routes.map((route) => {
    const { isRedirect, permission } = routeMap.get(route)
    const referencedInFiles = specFiles.filter((file, i) =>
      routeReferencedInSpecs(route, [specContents[i]]),
    )
    const hasReference = referencedInFiles.length > 0
    return {
      route,
      isRedirect,
      permission,
      status: isRedirect ? 'redirect' : hasReference ? 'tested' : 'untested',
      referencedSpecFiles: referencedInFiles.map((f) => f.replace(ROOT + '/', '')),
      lastDiscoveryRun: new Date().toISOString().slice(0, 10),
    }
  })

  mkdirSync(OUT_DIR, { recursive: true })
  mkdirSync(join(OUT_DIR, 'routes'), { recursive: true })
  writeFileSync(join(OUT_DIR, 'routes', 'routes.json'), JSON.stringify(results, null, 2) + '\n')

  const screens = results.filter((r) => !r.isRedirect)
  const redirects = results.filter((r) => r.isRedirect)
  const tested = screens.filter((r) => r.status === 'tested')
  const untested = screens.filter((r) => r.status === 'untested')
  const withPermission = screens.filter((r) => r.permission)
  const pct = screens.length > 0 ? ((tested.length / screens.length) * 100).toFixed(1) : '0.0'

  const lines = []
  lines.push('# Screen Coverage — otomatik üretildi (admin-panel)')
  lines.push('')
  lines.push(`_Üretilme: ${new Date().toISOString()} · Kaynak: \`src/App.tsx\` + \`tests/e2e/**/*.spec.ts\`_`)
  lines.push('')
  lines.push(
    '> `src/App.tsx`\'teki gerçek `<Route>` tanımları taranarak üretildi. Her route\'un ' +
      '`RequirePermission permission="..."` sarmalayıcısından çıkarılan yetki adı da ' +
      'listelenir — RBAC test matrisi (gap #6) için doğrudan kullanılabilir kaynak.',
  )
  lines.push('')
  lines.push('## Özet')
  lines.push('')
  lines.push(`- Toplam ekran (redirect hariç): **${screens.length}**`)
  lines.push(`- Yetki (permission) gerektiren ekran: **${withPermission.length}**`)
  lines.push(`- En az bir spec'te referans edilen: **${tested.length}**`)
  lines.push(`- Hiç referans edilmeyen: **${untested.length}**`)
  lines.push(`- Screen Coverage: **%${pct}**`)
  lines.push('')

  if (untested.length > 0) {
    lines.push('## ⚠️ UNTESTED SCREEN — hiçbir spec dosyasında referans yok')
    lines.push('')
    for (const r of untested) {
      lines.push(`- \`${r.route}\`${r.permission ? ` (permission: \`${r.permission}\`)` : ''}`)
    }
    lines.push('')
  }

  lines.push('## Tüm ekranlar')
  lines.push('')
  lines.push('| Route | Permission | Durum |')
  lines.push('|---|---|---|')
  for (const r of screens) {
    const icon = r.status === 'tested' ? '✅' : '❌'
    lines.push(`| \`${r.route}\` | ${r.permission ? `\`${r.permission}\`` : '—'} | ${icon} ${r.status} |`)
  }
  lines.push('')

  writeFileSync(join(OUT_DIR, 'SCREEN_COVERAGE.md'), lines.join('\n'))

  console.log(`Route discovery tamamlandı: ${screens.length} ekran + ${redirects.length} redirect bulundu.`)
  console.log(`Screen Coverage: %${pct} (${tested.length}/${screens.length})`)
  if (untested.length > 0) {
    console.log(`\nUNTESTED SCREEN (${untested.length}):`)
    for (const r of untested) console.log(`  - ${r.route}`)
  }
  console.log(`\nRapor: test-artifacts/SCREEN_COVERAGE.md`)
}

main()
