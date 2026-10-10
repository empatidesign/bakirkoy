#!/usr/bin/env node
/**
 * Tablet çevrimdışı uçtan uca testi (gerçek cihaz, gerçek arayüz, gerçek sunucu).
 *
 * Kullanıcı isteği (2026-09-03): "bu testin tam olarak çalışması lazım."
 * Daha önceki doğrulamalar token'ı elle localStorage'a enjekte ediyordu; bu
 * betik hiçbir şey enjekte etmez, anketörün yaptığı işi yapar:
 *
 *   1. Gerçek giriş ekranından TC + şifre + OTP ile giriş yapar
 *   2. Saha görev listesinden bir görevi açar
 *   3. UÇAK MODUNDA (Wi-Fi kapalı) anketi arayüzden doldurup gönderir
 *   4. Kaydın cihazda kuyruğa alındığını doğrular
 *   5. Wi-Fi'ı açar ve uygulamaya HİÇ DOKUNMADAN otomatik gönderimi bekler
 *   6. Sunucuda kaydın gerçekten oluştuğunu (completedCount arttı mı) doğrular
 *
 * Çalıştırma:
 *   node tools/tablet-offline-e2e.mjs
 *
 * Ortam değişkenleri (varsayılanlar geliştirme ortamına göre):
 *   TABLET_SERIAL, API_URL, TEST_TCKN, TEST_PASSWORD, TEST_OTP, APP_ID
 */
import { execFileSync } from 'node:child_process'
import WebSocket from 'ws'

const SERIAL = process.env.TABLET_SERIAL || 'L40092304347'
const API = process.env.API_URL || 'http://192.168.1.14:5207'
const TCKN = process.env.TEST_TCKN || '10000000214'
const PASSWORD = process.env.TEST_PASSWORD || 'Test2026!'
const OTP = process.env.TEST_OTP || '111111'
const APP = process.env.APP_ID || 'tr.gov.sultangazi.portal'
const PORT = 9755

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const adb = (args, opts = {}) => {
  try {
    return execFileSync('adb', ['-s', SERIAL, ...args], {
      encoding: 'utf8', timeout: opts.timeout ?? 30000, stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) { return e.stdout || '' }
}

const steps = []
const step = (name, ok, detail = '') => {
  steps.push({ name, ok, detail })
  console.log(`${ok ? 'GECTI' : 'KALDI'} | ${name}${detail ? ` -> ${detail}` : ''}`)
  if (!ok) throw new Error(`Adim basarisiz: ${name} ${detail}`)
}

// ---------------------------------------------------------------- ağ kontrolü
const wifi = (on) => adb(['shell', 'svc', 'wifi', on ? 'enable' : 'disable'])
const pingsServer = () => {
  const { hostname, port } = new URL(API)
  return adb(['shell', 'sh', '-c', `echo | nc -w 3 ${hostname} ${port || '80'} >/dev/null; echo $?`]).trim() === '0'
}
const waitForNet = async (want, maxSec = 45) => {
  for (let i = 0; i < maxSec; i += 3) {
    if (pingsServer() === want) return true
    await sleep(3000)
  }
  return false
}

// ------------------------------------------------------- WebView'e CDP bağlan
/**
 * Bu tablette WebView renderer'ı bazen "process is bad" ile açılmıyor (Android
 * tarafı, uygulama değil). Test bu yüzden kararsız kalmasın diye uygulamayı
 * birkaç kez yeniden başlatır, gerekirse cihazı reboot eder.
 */
async function attach({ restart = true, tries = 4, rebootBudget = 2 } = {}) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    if (restart || attempt > 1) {
      adb(['shell', 'am', 'force-stop', APP])
      await sleep(3000)
      adb(['shell', 'monkey', '-p', APP, '-c', 'android.intent.category.LAUNCHER', '1'])
      await sleep(16000)
    }
    adb(['forward', '--remove-all'])
    const socks = adb(['shell', 'cat', '/proc/net/unix'])
    const name = socks.match(/webview_devtools_remote_\d+/)?.[0]
    if (!name) { console.log(`  (baglanti denemesi ${attempt}: devtools soketi yok)`); continue }
    adb(['forward', `tcp:${PORT}`, `localabstract:${name}`])
    await sleep(1200)
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      if (!tabs.length) { console.log(`  (deneme ${attempt}: sekme yok)`); continue }
      const page = await connectPage(tabs[0].webSocketDebuggerUrl)
      const alive = await Promise.race([page.eval('1+1', false), sleep(9000).then(() => 'OLU')])
      if (alive === 'OLU') { console.log(`  (deneme ${attempt}: JS motoru yanit vermiyor)`); page.close(); continue }
      return page
    } catch (e) { console.log(`  (deneme ${attempt}: ${e.message})`) }
  }
  // Son çare: cihazı yeniden başlat (WebView süreç havuzunu temizler).
  // rebootBudget sınırlı: reboot da işe yaramazsa (örn. cihaz ekranı kilitli,
  // Wi-Fi kapalı kalmış) test sonsuz döngüye girmesin, açıkça hata versin.
  if (rebootBudget <= 0) {
    throw new Error('WebView acilamiyor: reboot hakki tukendi. Cihaz ekranini/kilidini kontrol edin.')
  }
  console.log(`  WebView acilmadi, cihaz yeniden baslatiliyor... (kalan reboot hakki: ${rebootBudget})`)
  adb(['reboot'])
  await sleep(60000)
  adb(['wait-for-device'], { timeout: 120000 })
  await sleep(30000)
  return attach({ restart: true, tries: 2, rebootBudget: rebootBudget - 1 })
}

function connectPage(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { perMessageDeflate: false })
    let id = 0
    const send = (method, params) => new Promise((res) => {
      const myId = ++id
      const onMsg = (m) => {
        const d = JSON.parse(m.toString())
        if (d.id === myId) { ws.off('message', onMsg); res(d.result) }
      }
      ws.on('message', onMsg)
      ws.send(JSON.stringify({ id: myId, method, params }))
    })
    const page = {
      ws,
      send,
      close: () => { try { ws.close() } catch { /* yoksay */ } },
      eval: (expression, awaitPromise = true) =>
        send('Runtime.evaluate', { awaitPromise, returnByValue: true, expression })
          .then((r) => (r?.exceptionDetails
            ? `JS_HATA: ${r.exceptionDetails.exception?.description ?? ''}`.slice(0, 200)
            : r?.result?.value)),
    }
    ws.on('open', () => resolve(page))
    ws.on('error', reject)
    setTimeout(() => reject(new Error('CDP baglanti zaman asimi')), 15000)
  })
}

// ------------------------------------------------- React kontrollü alana yazma
/**
 * React kontrollü input'lara .value atamak işe yaramaz (React kendi setter'ını
 * kullanır). Native setter + input olayı doğru yoldur. TC alanı maskeli
 * olabildiği için karakter karakter yazılır ve sonuç doğrulanır.
 */
const REACT_SET = `(el, ch) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, el.value + ch);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}`

async function typeInto(page, selectorJs, text) {
  await page.eval(`(() => {
    const set = ${REACT_SET};
    const el = ${selectorJs};
    if (!el) return 'YOK';
    const proto = HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`, false)
  for (const ch of text) {
    await page.eval(`(() => {
      const set = ${REACT_SET};
      const el = ${selectorJs};
      if (el) set(el, ${JSON.stringify(ch)});
      return el ? el.value : 'YOK';
    })()`, false)
    await sleep(40)
  }
  return page.eval(`(() => { const el = ${selectorJs}; return el ? el.value : 'YOK' })()`, false)
}

const digits = (v) => String(v ?? '').replace(/\D/g, '')
const screen = async (page, n = 200) =>
  String(await page.eval(`document.body.innerText.slice(0, ${n})`, false) || '').replace(/\s*\n+\s*/g, ' | ')

// -------------------------------------------------------------------- akışlar
async function login(page) {
  await page.eval(`location.href = '/login'`, false)
  await sleep(9000)

  const tc = await typeInto(page, `document.querySelectorAll('input')[0]`, TCKN)
  step('Giris: TC yazildi', digits(tc) === TCKN, `alan='${tc}'`)

  const pw = await typeInto(page, `document.querySelectorAll('input')[1]`, PASSWORD)
  step('Giris: sifre yazildi', String(pw).length === PASSWORD.length, `uzunluk=${String(pw).length}`)

  await page.eval(`document.querySelector('form').requestSubmit()`, false)
  await sleep(9000)

  const path = await page.eval('location.pathname', false)
  step('Giris: OTP ekranina gecildi', String(path).includes('/otp'), `yol=${path} ekran=${await screen(page, 120)}`)

  // OTP alanları: tek tek kutular ya da tek alan olabilir
  const otpInfo = await page.eval(`(() => {
    const all = [...document.querySelectorAll('input')];
    const boxes = all.filter(i => i.maxLength === 1);
    return JSON.stringify({ toplam: all.length, kutu: boxes.length });
  })()`, false)

  const { kutu } = JSON.parse(otpInfo)
  if (kutu >= OTP.length) {
    for (let i = 0; i < OTP.length; i++) {
      await page.eval(`(() => {
        const set = ${REACT_SET};
        const boxes = [...document.querySelectorAll('input')].filter(i => i.maxLength === 1);
        if (boxes[${i}]) { boxes[${i}].focus(); set(boxes[${i}], ${JSON.stringify(OTP[i])}); }
        return 1;
      })()`, false)
      await sleep(120)
    }
  } else {
    await typeInto(page, `[...document.querySelectorAll('input')].filter(i => i.inputMode === 'numeric' || i.maxLength >= 6)[0]`, OTP)
  }
  await sleep(1200)

  await page.eval(`(() => {
    const f = document.querySelector('form');
    if (f) { f.requestSubmit(); return 'form'; }
    const b = [...document.querySelectorAll('button')].find(x => /Doğrula|Onayla/i.test(x.textContent) && !x.disabled);
    if (b) { b.click(); return 'buton'; }
    return 'yok';
  })()`, false)
  await sleep(10000)

  const after = await page.eval('location.pathname', false)
  const hasToken = await page.eval(`!!(localStorage.getItem('access_token') || sessionStorage.getItem('access_token'))`, false)
  step('Giris: oturum acildi', hasToken === true && !String(after).includes('/login'),
    `yol=${after} token=${hasToken}`)
  step('Giris: oturum KALICI depoda', await page.eval(`!!localStorage.getItem('access_token')`, false) === true,
    'localStorage')
  step('Giris: profil onbellege alindi', await page.eval(`!!localStorage.getItem('auth_profile_cache')`, false) === true)
}

async function openFieldList(page) {
  await page.eval(`location.href = '/saha'`, false)
  await sleep(12000)
  const path = await page.eval('location.pathname', false)
  step('Saha: gorev sayfasi acildi', String(path).startsWith('/saha'), `yol=${path}`)
}

/** Bir koşul sağlanana kadar bekler (sabit sleep yerine; yavaş cihazda kararlı). */
async function waitFor(page, expr, { timeoutMs = 40000, everyMs = 1500 } = {}) {
  const start = Date.now()
  let last
  while (Date.now() - start < timeoutMs) {
    last = await page.eval(expr, false)
    if (last) return last
    await sleep(everyMs)
  }
  return last
}

/**
 * Görev kartları "Anketler" sekmesinde; açılışta "Dashboard" sekmesi gelir
 * (cihazda ölçüldü). Sekmeye geçip karttaki "Anketi Başlat" düğmesine basılır.
 * Çevrimdışıyken liste önbellekten geldiği için render birkaç saniye gecikebilir;
 * bu yüzden sabit bekleme değil, düğme sayısı > 0 olana kadar yoklama yapılır.
 */
async function openTaskCard(page) {
  const countExpr = `[...document.querySelectorAll('button')].filter(b => /Anketi Başlat|Devam Et/i.test(b.textContent || '') && !b.disabled).length`
  const entryScreenExpr = `!!(
    [...document.querySelectorAll('button')].find(b => /İsimsiz|Anonim|T\\.C\\. Kimlikli/i.test(b.textContent || '')) ||
    [...document.querySelectorAll('button')].find(b => /Ankete başla/i.test(b.textContent || ''))
  )`

  // Sekme görünene kadar bekle, sonra tıkla
  await waitFor(page, `!![...document.querySelectorAll('button, [role=tab]')].find(x => /^Anketler/.test((x.textContent || '').trim()))`)
  await page.eval(`[...document.querySelectorAll('button, [role=tab]')].find(x => /^Anketler/.test((x.textContent || '').trim()))?.click()`, false)
  await sleep(2500)

  // Devam eden (taslak) bir görev varsa uygulama bazen doğrudan anket ekranına
  // yönlendirir; bu durumda kart listesi hiç görünmez (cihazda ölçüldü).
  if (await page.eval(entryScreenExpr, false)) return 'tiklandi'

  // Kartlar render olana kadar bekle (önbellekten geliyorsa gecikebilir)
  const n = await waitFor(page, countExpr, { timeoutMs: 20000 })
  if (!Number(n)) {
    if (await page.eval(entryScreenExpr, false)) return 'tiklandi'
    const txt = await page.eval(`document.body.innerText.slice(0, 300).replace(/\\s+/g, ' ')`, false)
    return `BULUNAMADI(buton=0):${txt}`
  }

  const clicked = await page.eval(`(() => {
    const buttons = [...document.querySelectorAll('button')]
      .filter(b => /Anketi Başlat|Devam Et/i.test((b.textContent || '').trim()) && !b.disabled);
    // Soru sayısı 0 olan / pasif anket kartını atla
    const pick = buttons.find(b => {
      const card = b.closest('[class*=card], li, article') || b.parentElement?.parentElement;
      return !/0 soru|Anket pasif/i.test(card?.textContent || '');
    }) || buttons[0];
    pick.click();
    return true;
  })()`, false)
  if (!clicked) return 'BULUNAMADI(tiklanamadi)'

  // Sabit bekleme yerine: anket giriş ekranı (katılım türü ya da soru) görünene
  // kadar yokla. Çevrimdışı akışta önce hata gösterilip önbellekten geri
  // yükleniyor; bu geçiş 12sn'lik API timeout'una kadar sürebilir.
  const ready = await waitFor(page, entryScreenExpr, { timeoutMs: 30000 })
  if (!ready) {
    const txt = await page.eval(`document.body.innerText.slice(0, 400).replace(/\\s+/g, ' ')`, false)
    return `BULUNAMADI(giris-ekrani-gelmedi):${txt}`
  }
  return 'tiklandi'
}

/**
 * Anket akışı: 1) Giriş (katılımcı türü) 2) Sorular 3) Teşekkürler.
 * Çevrimdışı testte anonim katılım seçilir (TC doğrulaması sunucu ister).
 * Anonim katılımda yaş + cinsiyet zorunludur.
 */
async function fillSurvey(page, maxSteps = 30) {
  // --- Adım 1: anonim katılım seç ve ankete başla
  await page.eval(`(() => {
    const b = [...document.querySelectorAll('button')]
      .find(x => /İsimsiz|Anonim/i.test(x.textContent || '') && !x.disabled);
    if (b) b.click();
    return !!b;
  })()`, false)
  await sleep(2500)

  // Anonim katılımda yaş/cinsiyet zorunlu: görünen tüm seçim gruplarından birer seçim yap
  await page.eval(`(() => {
    const secilen = [];
    // Native select'ler
    document.querySelectorAll('select').forEach(sel => {
      if (sel.value) return;
      const opt = [...sel.options].find(o => o.value && !o.disabled);
      if (opt) {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        setter.call(sel, opt.value);
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        secilen.push('select');
      }
    });
    // Yaş / cinsiyet gibi düğme grupları
    const etiketler = [/^(18-24|25-34|35-44|45-54|55-64|65\\+)$/, /^(Kadın|Erkek)$/];
    etiketler.forEach(re => {
      const b = [...document.querySelectorAll('button, [role=radio]')]
        .find(x => re.test((x.textContent || '').trim()) && !x.disabled);
      if (b) { b.click(); secilen.push((b.textContent || '').trim()); }
    });
    return secilen.join(',');
  })()`, false)
  await sleep(1500)

  const started = await page.eval(`(() => {
    const b = [...document.querySelectorAll('button')]
      .find(x => /Ankete başla/i.test(x.textContent || '') && !x.disabled);
    if (!b) return 'BASLAT-YOK';
    b.click();
    return 'ok';
  })()`, false)
  if (started !== 'ok') {
    return { finished: false, steps: 0, screen: await screen(page, 400) }
  }
  await sleep(4000)

  // --- Adım 2: soruları sırayla cevapla
  for (let i = 0; i < maxSteps; i++) {
    await page.eval(`(() => {
      // Ölçek/şık düğmeleri: soru kartı içindeki seçilebilir düğmeler
      const opt = [...document.querySelectorAll('[role=radio], input[type=radio]')].find(e => !e.disabled);
      if (opt) { opt.click(); return 'sik'; }
      const scale = [...document.querySelectorAll('button')]
        .filter(b => /^[1-9]$|^(Çok memnun|Memnun|Kararsız|Memnun değil)$/i.test((b.textContent || '').trim()) && !b.disabled);
      if (scale.length) { scale[Math.min(1, scale.length - 1)].click(); return 'olcek'; }
      const ta = document.querySelector('textarea:not([disabled])');
      if (ta && !ta.value) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
        setter.call(ta, 'Otomatik test yaniti');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return 'metin';
      }
      const cb = document.querySelector('input[type=checkbox]:not([disabled])');
      if (cb && !cb.checked) { cb.click(); return 'kutu'; }
      return 'cevap-yok';
    })()`, false)
    await sleep(1200)

    const act = await page.eval(`(() => {
      const btns = [...document.querySelectorAll('button')].filter(b => !b.disabled);
      const bitir = btns.find(b => /Anketi Tamamla|Gönder|Tamamla|Bitir/i.test(b.textContent || ''));
      if (bitir) { bitir.click(); return 'bitir'; }
      const ileri = btns.find(b => /İleri|Sonraki|Devam/i.test(b.textContent || ''));
      if (ileri) { ileri.click(); return 'ileri'; }
      return 'buton-yok';
    })()`, false)
    await sleep(3000)

    if (act === 'bitir') return { finished: true, steps: i + 1 }
    if (act === 'buton-yok') return { finished: false, steps: i + 1, screen: await screen(page, 400) }
  }
  return { finished: false, steps: maxSteps, screen: await screen(page, 400) }
}

const queueLenExpr = `(() => { try { return JSON.parse(localStorage.getItem('nexora_field_offline_queue') || '[]').length } catch (e) { return -1 } })()`
const queueLength = (page) => page.eval(queueLenExpr, false)

/** Sunucudaki toplam tamamlanan anket sayısı (tüm saha görevleri). */
async function serverCompletedTotal(token) {
  const res = await fetch(`${API}/api/v1/me/surveys/field/tasks`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.json()
  const data = body?.data
  const items = Array.isArray(data) ? data : (data?.items ?? [])
  return items.reduce((sum, t) => sum + (t.completedCount ?? 0), 0)
}

async function main() {
  console.log(`=== Tablet cevrimdisi uctan uca test ===`)
  console.log(`cihaz=${SERIAL} api=${API}\n`)

  // Ön koşul: ağ açık ve sunucu erişilebilir olmalı
  wifi(true)
  step('On kosul: sunucuya erisim var', await waitForNet(true), API)

  // Temiz başlangıç: hiçbir kalıntı oturum/kuyruk olmasın
  adb(['shell', 'pm', 'clear', APP])
  await sleep(2000)

  let page = await attach()
  step('WebView devtools baglantisi kuruldu', true)

  // --- 1) Gerçek arayüzden giriş (hiçbir şey enjekte edilmiyor)
  await login(page)

  // Token'ı SADECE sunucu tarafını doğrulamak için okuyoruz (teste girdi değil)
  const token = await page.eval(`localStorage.getItem('access_token')`, false)
  const before = await serverCompletedTotal(token)
  console.log(`  (sunucu baslangic: toplam tamamlanan = ${before})`)

  // --- 2) Anketörün sahaya çıkmadan önce yaptığı hazırlık: görev listesini ve
  //        dolduracağı anketi AĞ VARKEN bir kez açar (böylece cihazda önbelleğe alınır)
  await openFieldList(page)
  step('Online: gorev listesi yuklendi ve onbellege alindi',
    await page.eval(`!!localStorage.getItem('field_tasks_cache')`, false) === true)

  const preOpened = await openTaskCard(page)
  step('Online: anket bir kez acildi (detay onbellege alindi)',
    String(preOpened).startsWith('tiklandi'), String(preOpened).slice(0, 160))
  step('Online: anket detayi onbellekte',
    await page.eval(`Object.keys(localStorage).some(k => k.startsWith('field_task_detail_'))`, false) === true)
  // --- 3) AĞI KES: buradan sonrası tamamen çevrimdışı
  wifi(false)
  step('Ag kesildi (ucak modu benzeri)', await waitForNet(false), 'sunucuya ping yok')

  // Uygulamayı çevrimdışıyken yeniden yükle: gerçek saha senaryosu
  await page.eval(`location.href = '/saha'`, false)
  const offlineText = await waitFor(page, `document.body.innerText.length > 100 ? document.body.innerText.length : 0`, { timeoutMs: 60000 })
  step('Cevrimdisi: saha ekrani BOS DEGIL', Number(offlineText) > 100,
    `metin uzunlugu=${offlineText}`)

  const opened = await openTaskCard(page)
  step('Cevrimdisi: gorev karti acildi', String(opened).startsWith('tiklandi'), String(opened).slice(0, 160))

  const filled = await fillSurvey(page)
  step('Cevrimdisi: anket arayuzden dolduruldu ve gonderildi',
    filled.finished, `adim=${filled.steps}${filled.screen ? ` ekran=${filled.screen}` : ''}`)

  // "Bitir"e tıklandıktan sonra gerçek submit isteği önce denenir ve API
  // timeout'una (12sn) çarpıp AĞ HATASI aldıktan sonra kuyruğa yazılır.
  // Sabit kısa bekleme yerine timeout süresini kapsayan bir yoklama yapılır.
  const qAfterSubmit = await waitFor(page, queueLenExpr, { timeoutMs: 20000, everyMs: 1000 }) || 0
  step('Cevrimdisi: kayit cihazda kuyruga alindi', Number(qAfterSubmit) >= 1, `kuyruk=${qAfterSubmit}`)

  // Kuyruk gerçekten bekliyor mu (ağ yokken boşalmamalı)
  await sleep(25000)
  const qStill = await queueLength(page)
  step('Cevrimdisi: kayit ag yokken kuyrukta kaliyor', qStill >= 1, `kuyruk=${qStill}`)

  // --- 3) AĞI AÇ ve uygulamaya HİÇ DOKUNMADAN bekle
  wifi(true)
  step('Ag geri geldi', await waitForNet(true), 'sunucuya ping var')

  let drained = false
  let waited = 0
  for (let i = 0; i < 9; i++) {
    await sleep(10000)
    waited += 10
    const n = await queueLength(page)
    console.log(`  ${waited}sn -> kuyruk: ${n}`)
    if (n === 0) { drained = true; break }
  }
  step('Ag donunce kuyruk OTOMATIK gonderildi (dokunulmadan)', drained, `${waited}sn icinde`)

  // --- 4) Sunucuda gerçekten kaydedildi mi?
  const after = await serverCompletedTotal(token)
  step('Sunucuda kayit olustu', after > before, `${before} -> ${after}`)

  page.close()
}

main().then(() => {
  console.log(`\nSONUC: ${steps.filter(s => s.ok).length}/${steps.length} adim gecti`)
  process.exit(0)
}).catch((e) => {
  console.error(`\nHATA: ${e.message}`)
  console.log(`SONUC: ${steps.filter(s => s.ok).length}/${steps.length} adim gecti`)
  process.exit(1)
})
