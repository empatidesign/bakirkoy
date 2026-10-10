#!/usr/bin/env node
// Kullanıcı isteği (2026-09-03): "android uygulama tablete yüklendi fakat aynı ağda
// şu anda ağa erişemiyor, bunun için gerekli düzenlemeyi ve testini yapmam lazım."
//
// Kök neden: paket VITE_API_URL=http://localhost:5207 ile derlenmişti. Mobil cihazda
// "localhost" sunucuyu değil CİHAZIN KENDİSİNİ gösterir, bu yüzden istekler geliştirme
// makinesine hiç ulaşmaz. Bu betik doğru ağ adresini bulur, ulaşılabilirliğini
// SINAR ve ancak testler geçerse cihaz paketini üretir.
//
// Kullanım:
//   node tools/build-mobile.mjs            # ağ adresini otomatik bul
//   API_HOST=192.168.1.50 node tools/...   # elle ver
//
// Not: paket üretmez, yalnızca ön kontrolleri yapıp komutu söyler (--build ile üretir).

import { networkInterfaces } from 'node:os'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const PORT = process.env.API_PORT || '5207'
const RUN_BUILD = process.argv.includes('--build')

/** LAN'daki IPv4 adresini bulur; sanal/VPN arayüzleri elenir. */
function findLanAddress() {
  if (process.env.API_HOST) return process.env.API_HOST
  const skip = /^(utun|ipsec|ppp|tun|tap|bridge|awdl|llw)/i
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    if (skip.test(name)) continue
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) return a.address
    }
  }
  return null
}

/**
 * Etkin ağ/paket filtresi sistem eklentilerini listeler. Bu eklentiler
 * bağlantıyı sessizce düşürdüğü için hata "reddedildi" yerine "zaman aşımı"
 * olarak görünür ve nedeni bulmak zorlaşır.
 */
function detectPacketFilters() {
  try {
    const out = execSync('systemextensionsctl list 2>/dev/null', { encoding: 'utf8' })
    return [...new Set(
      out.split('\n')
        .filter((l) => /\[activated enabled\]/.test(l) && /packetfilter|webfilter|firewall|proxy/i.test(l))
        .map((l) => (l.match(/com\.[a-z0-9.]+/i) ?? ['bilinmeyen'])[0]),
    )]
  } catch {
    return []
  }
}

async function reachable(url, timeoutMs = 5000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    return { ok: res.ok, status: res.status }
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'zaman aşımı' : err.message }
  } finally {
    clearTimeout(timer)
  }
}

const host = findLanAddress()
if (!host) {
  console.error('HATA: LAN IPv4 adresi bulunamadı. API_HOST=... ile elle verin.')
  process.exit(1)
}

const apiUrl = `http://${host}:${PORT}`
console.log(`Hedef API: ${apiUrl}`)

// 1) API bu makinede ayakta mı?
const local = await reachable(`http://127.0.0.1:${PORT}/health`)
if (!local.ok) {
  console.error(`HATA: API bu makinede yanıt vermiyor (127.0.0.1:${PORT}) — ${local.error ?? local.status}`)
  console.error('       Önce API\'yi başlatın.')
  process.exit(1)
}
console.log('✓ API bu makinede çalışıyor')

// 2) API ağ arayüzünü dinliyor mu? (yalnızca localhost dinliyorsa tablet erişemez)
const lan = await reachable(`${apiUrl}/health`)
if (!lan.ok) {
  console.error(`\nHATA: API ağ adresinden erişilemiyor (${apiUrl}) — ${lan.error ?? lan.status}`)
  console.error('Olası nedenler ve çözümleri:')
  console.error(`  1. API yalnızca localhost dinliyor olabilir.`)
  console.error(`     Çözüm: --urls "http://0.0.0.0:${PORT}" ile başlatın.`)
  console.error('     Kontrol: lsof -iTCP:' + PORT + ' -sTCP:LISTEN -P -n  →  "*:' + PORT + '" görmelisiniz.')
  console.error('  2. Güvenlik yazılımı / kurumsal ajan gelen bağlantıyı engelliyor olabilir.')
  console.error('     Belirti: bağlantı "reddedildi" değil "zaman aşımı" verir; ping çalışsa bile TCP açılmaz.')
  const filters = detectPacketFilters()
  if (filters.length > 0) {
    console.error(`     TESPİT EDİLDİ: ${filters.join(', ')} — etkin paket filtresi bu makinede çalışıyor.`)
    console.error('     Çözüm: bu ajanı geçici durdurun veya ' + PORT + ' portuna gelen bağlantıya izin verin.')
    console.error('     (Kurumsal bir araç olabilir; durdurmadan önce BT biriminize danışın.)')
  } else {
    console.error('     Çözüm: güvenlik yazılımını geçici durdurun veya ' + PORT + ' portuna izin verin.')
  }
  console.error('  3. Wi-Fi ağında istemci yalıtımı (AP isolation) açık olabilir; misafir ağı yerine ana ağı kullanın.')
  process.exit(1)
}
console.log(`✓ API ağdan erişilebilir (${apiUrl}/health → ${lan.status})`)
console.log('  Tabletin aynı ağda olduğundan emin olun; tarayıcısında bu adresi açarak da doğrulayabilirsiniz.')

// Android platformu bu depoda tutulmuyor (android/ klasörü yok). cap sync yalnızca
// platform eklenmiş bir çalışma kopyasında anlamlıdır; yoksa web paketi üretilir ve
// android klasörünün bulunduğu makinede senkronlanır.
const projectDir = new URL('..', import.meta.url).pathname
const hasAndroid = existsSync(join(projectDir, 'android'))

const env = `VITE_API_URL=${apiUrl} CAP_ALLOW_CLEARTEXT=true`
const buildCmd = hasAndroid ? `${env} npm run cap:sync` : `${env} npm run build`

if (!RUN_BUILD) {
  console.log('\nÖn kontroller geçti. Paketi üretmek için:')
  console.log(`  ${buildCmd}`)
  if (!hasAndroid) {
    console.log('\nNOT: Bu kopyada android/ klasörü yok, bu yüzden yalnızca web paketi üretilir.')
    console.log('     APK almak için Android platformu bir kez eklenmeli:')
    console.log(`       ${env} npm run build && npx cap add android && npx cap sync`)
    console.log('     Platform zaten başka bir kopyada ekliyse, üretilen dist/ klasörünü oraya taşıyın.')
  }
  console.log('veya bu betiği --build ile çalıştırın.')
  process.exit(0)
}

console.log(`\nPaket üretiliyor: ${buildCmd}`)
execSync(buildCmd, { stdio: 'inherit', cwd: projectDir })

if (hasAndroid) {
  console.log('\n✓ Paket hazır ve android/ ile senkronlandı. Android Studio ile tablete yükleyin.')
} else {
  console.log('\n✓ Web paketi hazır (dist/).')
  console.log('  APK için: npx cap add android && npx cap sync  (veya dist/ klasörünü android kopyasına taşıyın)')
}
