#!/usr/bin/env node
/**
 * Permission Matrix (QA gap #6, #26 — 2026-09-04) — doğrudan Postgres'ten üretir.
 *
 * Kök neden: hiçbir yerde otomatik, canlı veriden üretilen bir Permission Matrix
 * yoktu. Bu script `RolePermissions` tablosundan gerçek rol×yetki eşleşmesini
 * çekip `test-artifacts/PERMISSION_MATRIX.md` üretir.
 *
 * API üzerinden değil DOĞRUDAN DB'den okunuyor: `/api/v1/roles` sayfalama yapıyor
 * ve her rolün yetkilerini ayrı `GetById` çağrısı gerektiriyor (N+1 sorgu riski,
 * kırılgan bir test bağımlılığı). DB tek kaynaktan gerçeği doğrudan veriyor.
 *
 * Kullanım: `E2E_PG_CONN=postgresql://... node tests/discovery/generatePermissionMatrix.mjs`
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const OUT_DIR = join(ROOT, 'test-artifacts')

const conn = process.env.E2E_PG_CONN
if (!conn) {
  console.error('E2E_PG_CONN verilmedi. Örnek: postgresql://nexora_admin:PASSWORD@localhost:34100/nexora')
  process.exit(1)
}

const QUERY = `
SELECT r."Name" AS role_name, p."Key" AS permission_key
FROM "Roles" r
JOIN "RolePermissions" rp ON rp."RoleId" = r."Id"
JOIN "Permissions" p ON p."Id" = rp."PermissionId"
WHERE r."IsDeleted" = false
ORDER BY r."Name", p."Key";
`

function runQuery() {
  const output = execFileSync('psql', [conn, '-t', '-A', '-F', '\t', '-c', QUERY], {
    encoding: 'utf-8',
  })
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [roleName, permissionKey] = line.split('\t')
      return { roleName, permissionKey }
    })
}

function main() {
  const rows = runQuery()
  if (rows.length === 0) {
    console.error('Sorgu sonucu boş döndü — bağlantıyı/tablo adlarını kontrol et.')
    process.exit(1)
  }

  const roleNames = [...new Set(rows.map((r) => r.roleName))].sort()
  const modules = [...new Set(rows.map((r) => r.permissionKey.split('.')[0]))].sort()

  // module x role -> Set(actions) haritası ("view", "create", "edit", "delete" vb.)
  const grid = new Map() // key: `${module}::${role}` -> Set<action>
  for (const { roleName, permissionKey } of rows) {
    const [mod, action] = permissionKey.split('.')
    const key = `${mod}::${roleName}`
    if (!grid.has(key)) grid.set(key, new Set())
    grid.get(key).add(action ?? '?')
  }

  const lines = []
  lines.push('# Permission Matrix — otomatik üretildi')
  lines.push('')
  lines.push(`_Üretilme: ${new Date().toISOString()} · Kaynak: Postgres \`RolePermissions\` tablosu (canlı DB)_`)
  lines.push('')
  lines.push(
    '> Bu tablo elle yazılmıyor — her koşuda backend veritabanındaki gerçek rol×yetki ' +
      'eşleşmesinden türetilir (bkz. `docs/QA_MASTER_PROMPT_GAP_ANALYSIS_2026-09-04.md` madde 26).',
  )
  lines.push('')
  lines.push(`- Toplam rol: **${roleNames.length}**`)
  lines.push(`- Toplam modül: **${modules.length}**`)
  lines.push('')
  lines.push(`| Modül | ${roleNames.join(' | ')} |`)
  lines.push(`|---|${roleNames.map(() => '---:').join('|')}|`)
  for (const mod of modules) {
    const cells = roleNames.map((role) => {
      const actions = grid.get(`${mod}::${role}`)
      if (!actions) return '❌'
      return `✅ (${[...actions].sort().join(',')})`
    })
    lines.push(`| ${mod} | ${cells.join(' | ')} |`)
  }
  lines.push('')

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'PERMISSION_MATRIX.md'), lines.join('\n'))

  console.log(`Permission Matrix üretildi: ${roleNames.length} rol × ${modules.length} modül.`)
  console.log('Rapor: test-artifacts/PERMISSION_MATRIX.md')
}

main()
