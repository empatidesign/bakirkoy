#!/usr/bin/env node
/**
 * Route discovery (QA gap #21-22) + Screen Coverage report (QA gap #23-24) — 2026-09-04.
 *
 * Kök neden: `docs/citizen-portal-test-coverage.md` elle yazılmıştı, otomatik
 * güncellenmiyordu; yeni bir route eklendiğinde kimse fark etmeden test kapsamı
 * dışında kalabiliyordu (bkz. gap analysis raporundaki `loyalty`/`/sadakat` örneği
 * — hiçbir spec'te referans edilmiyordu, kimse fark etmemişti).
 *
 * Bu script:
 *   1. `src/App.tsx`'i STATİK OLARAK ayrıştırıp gerçek `<Route path="...">`
 *      tanımlarının tam listesini çıkarır (elle yazılmış bir liste değil).
 *   2. `tests/e2e/**\/*.spec.ts` içindeki tüm string literal'leri tarayıp hangi
 *      route'a en az bir kez referans verildiğini tespit eder (`goto('/x')`,
 *      `ROUTES` dizisi, path string'i vb. — spec'in NASIL test ettiğini bilmez,
 *      sadece route'un adının geçip geçmediğini bilir, bu yüzden sonuç "referans
 *      var/yok" seviyesindedir, "derinlemesine test edildi" iddiası değildir).
 *   3. `test-artifacts/routes.json` (madde 22) ve `test-artifacts/SCREEN_COVERAGE.md`
 *      (madde 23) üretir.
 *
 * Kullanım: `node tests/discovery/discoverRoutes.mjs`
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..') // citizen-portal/
const APP_TSX = join(ROOT, 'src', 'App.tsx')
const TESTS_DIR = join(ROOT, 'tests', 'e2e')
const OUT_DIR = join(ROOT, 'test-artifacts')

/** `src/App.tsx`'ten `<Route path="...">` tanımlarını statik olarak çıkarır. */
function extractRoutes(appTsxPath) {
  const source = readFileSync(appTsxPath, 'utf-8')
  const routeRegex = /<Route\s+path="([^"]+)"\s+element=\{<([^\s/>]+)/g
  const routes = new Map()
  let match
  while ((match = routeRegex.exec(source)) !== null) {
    const [, path, elementName] = match
    // Wildcard/catch-all route'larını coverage listesinden çıkar — bunlar "ekran"
    // değil, yönlendirme kuralı.
    if (path === '*' || path.includes('/*')) continue
    // RedirectKeepQuery/Navigate hedefleri gerçek bir ekran değil, eski URL'den
    // yeni URL'ye köprü — coverage'da ayrı işaretlenir ("redirect"), untested
    // sayılmaz (test edilecek bir UI'ları yok).
    const isRedirect = elementName === 'RedirectKeepQuery' || elementName === 'Navigate'
    routes.set(path, { isRedirect })
  }
  return routes
}

/** Bir dizin altındaki tüm `.spec.ts` dosyalarının tam yollarını (recursive) döner. */
function findSpecFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === 'artifacts') continue // ekran görüntüsü/video klasörü, kod değil
      results.push(...findSpecFiles(full))
    } else if (entry.endsWith('.spec.ts')) {
      results.push(full)
    }
  }
  return results
}

/**
 * Verilen route'un herhangi bir spec dosyasında (dosya adı olarak DEĞİL, içerik
 * olarak) geçip geçmediğini kontrol eder. Dinamik segmentler (`:companyId` gibi)
 * normalize edilir — spec'te tam parametre değeriyle geçebilir, prefix eşleşmesi
 * yeterli sayılır.
 */
function routeReferencedInSpecs(route, specContents) {
  // Dinamik segmenti kırp: "/kampanyalar/firma/:companyId" -> "/kampanyalar/firma/"
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
    const { isRedirect } = routeMap.get(route)
    const referencedInFiles = specFiles.filter((file, i) =>
      routeReferencedInSpecs(route, [specContents[i]]),
    )
    const hasReference = referencedInFiles.length > 0
    return {
      route,
      isRedirect,
      status: isRedirect ? 'redirect' : hasReference ? 'tested' : 'untested',
      referencedSpecFiles: referencedInFiles.map((f) => f.replace(ROOT + '/', '')),
      lastDiscoveryRun: new Date().toISOString().slice(0, 10),
    }
  })

  mkdirSync(OUT_DIR, { recursive: true })
  mkdirSync(join(OUT_DIR, 'routes'), { recursive: true })

  // madde 22: routes.json
  writeFileSync(
    join(OUT_DIR, 'routes', 'routes.json'),
    JSON.stringify(results, null, 2) + '\n',
  )

  // madde 23-24: SCREEN_COVERAGE.md — sadece gerçek ekranlar (redirect hariç) coverage
  // yüzdesine dahil edilir; bir redirect'in "test edilmemesi" ekran eksikliği değildir.
  const screens = results.filter((r) => !r.isRedirect)
  const redirects = results.filter((r) => r.isRedirect)
  const tested = screens.filter((r) => r.status === 'tested')
  const untested = screens.filter((r) => r.status === 'untested')
  const pct = screens.length > 0 ? ((tested.length / screens.length) * 100).toFixed(1) : '0.0'

  const lines = []
  lines.push('# Screen Coverage — otomatik üretildi')
  lines.push('')
  lines.push(`_Üretilme: ${new Date().toISOString()} · Kaynak: \`src/App.tsx\` + \`tests/e2e/**/*.spec.ts\`_`)
  lines.push('')
  lines.push(
    '> Bu rapor **elle yazılmıyor**. `src/App.tsx`\'teki gerçek `<Route>` tanımları ' +
      've `tests/e2e/` altındaki spec dosyalarının içeriği taranarak her koşuda ' +
      'yeniden üretilir (bkz. `docs/QA_MASTER_PROMPT_GAP_ANALYSIS_2026-09-04.md` madde 23-24).',
  )
  lines.push('')
  lines.push(
    '> ⚠️ "tested" durumu SADECE route adının bir spec dosyasında geçtiğini gösterir, ' +
      'o ekranın **derinlemesine** test edildiğini garanti etmez (yüzeysel smoke-check ' +
      'de "tested" sayılır). Gerçek derinlik için `docs/citizen-portal-test-coverage.md`\'deki ' +
      'KAPSAMLI/YÜZEYSEL sınıflandırmasına bak.',
  )
  lines.push('')
  lines.push('## Özet')
  lines.push('')
  lines.push(`- Toplam ekran (redirect hariç): **${screens.length}**`)
  lines.push(`- En az bir spec'te referans edilen: **${tested.length}**`)
  lines.push(`- Hiç referans edilmeyen: **${untested.length}**`)
  lines.push(`- Redirect route (coverage'a dahil değil): **${redirects.length}**`)
  lines.push(`- Screen Coverage: **%${pct}**`)
  lines.push('')

  if (untested.length > 0) {
    lines.push('## ⚠️ UNTESTED SCREEN — hiçbir spec dosyasında referans yok')
    lines.push('')
    for (const r of untested) {
      lines.push(`- \`${r.route}\``)
    }
    lines.push('')
  }

  lines.push('## Tüm ekranlar')
  lines.push('')
  lines.push('| Route | Durum | Referans veren spec dosyası sayısı |')
  lines.push('|---|---|---|')
  for (const r of screens) {
    const icon = r.status === 'tested' ? '✅' : '❌'
    lines.push(`| \`${r.route}\` | ${icon} ${r.status} | ${r.referencedSpecFiles.length} |`)
  }
  lines.push('')

  if (redirects.length > 0) {
    lines.push('## Redirect route\'lar (coverage dışı, referans için listelendi)')
    lines.push('')
    for (const r of redirects) {
      lines.push(`- \`${r.route}\``)
    }
    lines.push('')
  }

  writeFileSync(join(OUT_DIR, 'SCREEN_COVERAGE.md'), lines.join('\n'))

  console.log(`Route discovery tamamlandı: ${screens.length} ekran + ${redirects.length} redirect bulundu.`)
  console.log(`Screen Coverage: %${pct} (${tested.length}/${screens.length})`)
  if (untested.length > 0) {
    console.log(`\nUNTESTED SCREEN (${untested.length}):`)
    for (const r of untested) console.log(`  - ${r.route}`)
  }
  console.log(`\nRapor: test-artifacts/SCREEN_COVERAGE.md`)
  console.log(`Route envanteri: test-artifacts/routes/routes.json`)
}

main()
