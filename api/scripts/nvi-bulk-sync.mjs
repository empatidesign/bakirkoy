#!/usr/bin/env node
// ============================================================================
// NVİ TOPLU SORGULAMA SCRIPTİ
// ----------------------------------------------------------------------------
// Kullanıcı isteği (2026-10-06): katılımcıların NVİ bilgileri (ad soyad, cinsiyet,
// doğum tarihi, adres, 18 yaş altı çocukları) toplu olarak çekilsin; her 3 saniyede
// bir kişi sorgulansın. Admin paneldeki "NVİ Toplu Sorgula" butonunun komut satırı
// karşılığıdır, aynı ucu kullanır: POST /api/v1/participants/{id}/nvi-refresh
// (yetki, kapsam kontrolü ve denetim kaydı API tarafında yapılır).
//
// Kullanım:
//   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... E2E_OTP_CODE=111111 \
//     node nvi-bulk-sync.mjs                    # NVİ'den hiç sorgulanmamış herkes
//   node nvi-bulk-sync.mjs --tckn 12345678901   # tek kişi
//   node nvi-bulk-sync.mjs --tckn-file liste.txt  # dosyadaki TC'ler (satır başına bir)
//   node nvi-bulk-sync.mjs --limit 500 --interval 3000
//
// Ortam değişkenleri: API_URL (varsayılan http://localhost:34000), E2E_ADMIN_EMAIL,
// E2E_ADMIN_PASSWORD, E2E_OTP_CODE (admin girişi SMS OTP istiyorsa).
// Ctrl+C ile durdurulabilir; tekrar çalıştırınca sorgulanmamışlardan devam eder.
// ============================================================================

import { readFileSync, appendFileSync } from 'node:fs';

const API = process.env.API_URL || 'http://localhost:34000';
const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const INTERVAL = Number(arg('interval', 3000));
const LIMIT = Number(arg('limit', Infinity));
const LOG_FILE = arg('log', `nvi-bulk-sync-${new Date().toISOString().slice(0, 10)}.log`);

let token = null;
let refreshToken = null;

async function req(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

async function login() {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('E2E_ADMIN_EMAIL ve E2E_ADMIN_PASSWORD ortam değişkenleri gerekli.');
  token = null;
  const r = await req('POST', '/api/v1/auth/login', { email, password });
  if (!r.ok) throw new Error(`Giriş başarısız: HTTP ${r.status} ${r.json?.message ?? ''}`);
  let d = r.json.data;
  if (d.requiresOtp) {
    const code = process.env.E2E_OTP_CODE;
    if (!code) throw new Error('Admin girişi OTP istiyor: E2E_OTP_CODE ortam değişkenini verin.');
    const v = await req('POST', '/api/v1/auth/verify-otp', { otpSessionToken: d.otpSessionToken, code });
    if (!v.ok) throw new Error(`OTP doğrulama başarısız: HTTP ${v.status} ${v.json?.message ?? ''}`);
    d = v.json.data;
  }
  token = d.accessToken;
  refreshToken = d.refreshToken;
}

async function authed(method, path, body) {
  let r = await req(method, path, body);
  if (r.status === 401) {
    const rr = refreshToken ? await req('POST', '/api/v1/auth/refresh', { refreshToken }) : { ok: false };
    if (rr.ok) { token = rr.json.data.accessToken; refreshToken = rr.json.data.refreshToken; }
    else await login();
    r = await req(method, path, body);
  }
  return r;
}

const processed = new Set();

async function nextUnsynced() {
  const r = await authed('GET', '/api/v1/participants?page=1&limit=100&nviSynced=false&sort=registeredAt&order=asc');
  if (!r.ok) throw new Error(`Liste alınamadı: HTTP ${r.status}`);
  return r.json.data.items.find((p) => !processed.has(p.id)) ?? null;
}

async function byTckn(tckn) {
  const r = await authed('GET', `/api/v1/participants/by-tckn/${tckn}`);
  return r.ok && r.json.data?.exists ? r.json.data.participant : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let stop = false;
process.on('SIGINT', () => { stop = true; console.log('\nDurduruluyor (mevcut sorgu bitince)...'); });

function log(line) {
  console.log(line);
  appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`);
}

async function main() {
  await login();
  const tckns = arg('tckn') ? [arg('tckn')]
    : arg('tckn-file') ? readFileSync(arg('tckn-file'), 'utf-8').split(/\s+/).filter(Boolean) : null;

  const totalRes = await authed('GET', '/api/v1/participants?page=1&limit=1&nviSynced=false');
  const total = tckns ? tckns.length : totalRes.json?.data?.total ?? 0;
  log(`NVİ toplu sorgu başladı: ${total} kişi, ${INTERVAL / 1000} sn aralıkla (${API})`);

  let ok = 0, fail = 0, i = 0;
  while (!stop && i < LIMIT) {
    let p;
    if (tckns) {
      if (i >= tckns.length) break;
      p = await byTckn(tckns[i]);
      if (!p) { log(`[${i + 1}/${total}] ${tckns[i]} sistemde bulunamadı, atlandı`); fail++; i++; continue; }
    } else {
      p = await nextUnsynced();
      if (!p) break;
    }
    processed.add(p.id);
    i++;

    const r = await authed('POST', `/api/v1/participants/${p.id}/nvi-refresh`);
    if (r.ok) {
      const d = r.json.data;
      ok++;
      log(`[${i}/${total}] OK  ${d.fullName} | ${d.gender} | ${String(d.birthDate).slice(0, 10)} | ${d.neighborhood ?? d.district ?? '-'} | ${d.childrenCount} çocuk`);
    } else {
      fail++;
      log(`[${i}/${total}] HATA ${p.fullName}: ${r.json?.message ?? `HTTP ${r.status}`}`);
    }
    await sleep(INTERVAL);
  }
  log(`Bitti: ${ok} başarılı, ${fail} hata. Kayıt: ${LOG_FILE}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
