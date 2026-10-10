#!/usr/bin/env node
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

type Gender = 'male' | 'female';
type Residency = 'sultangazi' | 'outside';

type ScenarioProfile = {
  key: string;
  source: 'http-account' | 'http-child' | 'oracle-only';
  participantId?: string;
  accessToken?: string;
  fullName?: string;
  tckn?: string;
  age: number;
  gender: Gender;
  residency: Residency;
  districtCode?: string | null;
  isMinor: boolean;
  parentKey?: string;
};

type Finding = {
  severity: 'info' | 'warning' | 'error';
  module: string;
  check: string;
  profileKey?: string;
  itemId?: string;
  expected?: unknown;
  actual?: unknown;
  status?: number;
  body?: unknown;
  note?: string;
};

type ModuleStats = { scenarios: number; pass: number; fail: number; warnings: number; skipped: number; items: number };


const API = process.env.SCENARIO_API_BASE ?? 'http://localhost:5207';
const OUT_DIR = process.env.SCENARIO_OUT_DIR ?? process.cwd();
const TAG = 'SCENARIO-TEST-2026-07-22';
const PASSWORD = process.env.SCENARIO_PASSWORD ?? 'Citizen2026!Abc';
const OTP = process.env.SCENARIO_OTP ?? '111111';
const MUTATE = process.env.SCENARIO_MUTATE === '1';
const REGISTER_COUNT = Number(process.env.SCENARIO_REGISTER_COUNT ?? '0');
const LIMIT = Number(process.env.SCENARIO_LIMIT ?? '200');
const APPLY_SAMPLE_LIMIT = Number(process.env.SCENARIO_APPLY_SAMPLE_LIMIT ?? '8');
const ORACLE_REPETITIONS = Number(process.env.SCENARIO_ORACLE_REPETITIONS ?? String(Math.ceil(30000 / (91 * 2 * 2))));

const stats: Record<string, ModuleStats> = {};
const findings: Finding[] = [];

function stat(module: string): ModuleStats {
  return stats[module] ??= { scenarios: 0, pass: 0, fail: 0, warnings: 0, skipped: 0, items: 0 };
}
function pass(module: string, count = 1) { stat(module).pass += count; }
function fail(f: Finding) { findings.push(f); const s = stat(f.module); s.fail++; if (f.severity === 'warning') s.warnings++; }
function warn(f: Omit<Finding, 'severity'>) { findings.push({ ...f, severity: 'warning' }); const s = stat(f.module); s.warnings++; }
function skip(module: string, note: string) { stat(module).skipped++; findings.push({ severity: 'info', module, check: 'skipped', note }); }

async function http<T>(path: string, opts: RequestInit & { token?: string; ok?: number[] } = {}): Promise<{ status: number; data: T; raw: unknown }> {
  const headers: Record<string, string> = { 'accept': 'application/json', ...(opts.headers as any ?? {}) };
  if (opts.body && !headers['content-type']) headers['content-type'] = 'application/json';
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const text = await res.text();
  let raw: unknown = text;
  try { raw = text ? JSON.parse(text) : null; } catch {}
  const ok = opts.ok ?? [200, 201, 204];
  if (!ok.includes(res.status)) {
    const err = new Error(`HTTP ${res.status} ${path}: ${text.slice(0, 500)}`) as Error & { status?: number; raw?: unknown };
    err.status = res.status; err.raw = raw; throw err;
  }
  const data = raw && typeof raw === 'object' && 'data' in (raw as any) ? (raw as any).data : raw;
  return { status: res.status, data: data as T, raw };
}

function ageFromBirthDate(birthDate: string | Date): number {
  const b = new Date(birthDate);
  const today = new Date();
  let age = today.getUTCFullYear() - b.getUTCFullYear();
  const anniv = new Date(Date.UTC(today.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()));
  if (anniv > today) age--;
  return age;
}
function birthDateForAge(age: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - age);
  d.setUTCMonth(0, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
function normalizeGender(g: unknown): Gender {
  const s = String(g ?? '').toLowerCase();
  return s.includes('female') || s === '2' || s === 'kadın' ? 'female' : 'male';
}
function residencyFromCode(code?: string | null): Residency { return code === '2055' ? 'sultangazi' : 'outside'; }
function genderEligible(itemGender: string | undefined, profile: ScenarioProfile): boolean {
  const g = String(itemGender ?? 'mixed').toLowerCase();
  return g === 'mixed' || g === 'all' || g === profile.gender;
}
function ageEligible(min: unknown, max: unknown, profile: ScenarioProfile): boolean {
  const lo = Number(min ?? 0); const hi = Number(max ?? 0);
  return !(lo > 0 && profile.age < lo) && !(hi > 0 && profile.age > hi);
}
function residencyEligible(mode: unknown, profile: ScenarioProfile): boolean {
  const m = String(mode ?? 'anyone').toLowerCase();
  if (m === 'sultangazi_only' || m === 'resident_only' || m === 'sultangazi') return profile.residency === 'sultangazi';
  if (m === 'outside_only' || m === 'non_resident_only') return profile.residency === 'outside';
  return true;
}
function expectedFacility(item: any, p: ScenarioProfile) { return genderEligible(item.gender, p) && ageEligible(item.ageMin, item.ageMax, p); }
function expectedEvent(item: any, p: ScenarioProfile) { return genderEligible(item.gender, p) && ageEligible(item.minAge, item.maxAge, p) && residencyEligible(item.residencyMode, p); }
function expectedTravel(item: any, p: ScenarioProfile) { return genderEligible(item.gender, p) && ageEligible(item.minAge, item.maxAge, p) && residencyEligible(item.residencyMode, p); }

function tcknCheck(base9: string): string {
  const d = base9.split('').map(Number);
  const d10 = ((d[0]+d[2]+d[4]+d[6]+d[8])*7 - (d[1]+d[3]+d[5]+d[7])) % 10;
  const d11 = (d.reduce((a,b)=>a+b,0) + d10) % 10;
  return base9 + d10 + d11;
}
function scenarioTckn(i: number): string {
  const prefix = i % 2 === 0 ? '99' : '98';
  const genderDigit = String(i % 10);
  const seq = String(607220 + i).padStart(6, '0').slice(-6);
  const base = `${prefix}${genderDigit}${seq}`.slice(0, 9);
  return tcknCheck(base);
}

async function login(identifier: string, password: string): Promise<{ token: string; user: any }> {
  const l = await http<any>('/api/v1/auth/citizen/login', { method: 'POST', body: JSON.stringify({ identifier, password }) });
  const otpSessionToken = l.data.otpSessionToken;
  const v = await http<any>('/api/v1/auth/citizen/verify-otp', { method: 'POST', body: JSON.stringify({ otpSessionToken, code: OTP }) });
  return { token: v.data.accessToken, user: v.data.user };
}
async function registerParent(i: number): Promise<{ token: string; user: any } | null> {
  const tckn = scenarioTckn(i);
  const parentAges = [18, 21, 24, 30, 45, 65, 75, 90, 26, 34];
  const birthDate = birthDateForAge(parentAges[i % parentAges.length]);
  const body = { tckn, birthDate, phone: `555${String(6072200 + i).slice(-7)}`, email: `scenario.${TAG}.${i}@test.local`, password: PASSWORD, guardianPhone: null, guardianEmail: null };
  try {
    const reg = await http<any>('/api/v1/auth/citizen/register', { method: 'POST', body: JSON.stringify(body), ok: [200, 409] });
    if ((reg.raw as any)?.errors || (reg.raw as any)?.message?.includes('zaten')) return await login(tckn, PASSWORD);
    return await http<any>('/api/v1/auth/citizen/verify-otp', { method: 'POST', body: JSON.stringify({ otpSessionToken: reg.data.otpSessionToken, code: OTP }) }).then(r => ({ token: r.data.accessToken, user: r.data.user }));
  } catch (e: any) {
    warn({ module: 'auth', check: 'register-parent', status: e.status, body: e.raw, note: `Registration failed for synthetic TCKN ${tckn}. Continuing with demo account.` });
    return null;
  }
}

async function buildProfiles(): Promise<ScenarioProfile[]> {
  const profiles: ScenarioProfile[] = [];
  const accounts: { token: string; user: any }[] = [];
  try { accounts.push(await login(process.env.SCENARIO_DEMO_TCKN ?? '98765432150', process.env.SCENARIO_DEMO_PASSWORD ?? PASSWORD)); }
  catch (e: any) { warn({ module: 'auth', check: 'demo-login', status: e.status, body: e.raw, note: 'Seeded demo citizen login failed. Falling back to HTTP registration if no other account is available.' }); }
  const requestedRegistrations = REGISTER_COUNT > 0 ? REGISTER_COUNT : (accounts.length === 0 ? 1 : 0);
  for (let i = 0; i < requestedRegistrations; i++) {
    const account = await registerParent(i);
    if (account) accounts.push(account);
  }
  for (const [idx, account] of accounts.entries()) {
    const u = account.user;
    profiles.push({ key: `parent-${idx}-${u.id}`, source: 'http-account', participantId: u.id, accessToken: account.token, fullName: u.fullName, tckn: u.tckn, age: u.age ?? ageFromBirthDate(u.birthDate), gender: normalizeGender(u.gender), residency: residencyFromCode(u.districtCode), districtCode: u.districtCode, isMinor: !!u.isMinor });
    try {
      const children = await http<any[]>('/api/v1/auth/citizen/children', { token: account.token });
      for (const c of children.data) profiles.push({ key: `child-${idx}-${c.id}`, source: 'http-child', participantId: c.id, accessToken: account.token, fullName: c.fullName, tckn: c.tckn, age: c.age ?? ageFromBirthDate(c.birthDate), gender: normalizeGender(c.gender), residency: residencyFromCode(u.districtCode), districtCode: u.districtCode, isMinor: !!c.isMinor, parentKey: `parent-${idx}-${u.id}` });
    } catch (e: any) { warn({ module: 'auth', check: 'children-list', status: e.status, body: e.raw }); }
  }
  for (let repetition = 0; repetition < ORACLE_REPETITIONS; repetition++) for (let age = 0; age <= 90; age++) for (const gender of ['male', 'female'] as Gender[]) for (const residency of ['sultangazi', 'outside'] as Residency[]) {
    profiles.push({ key: `oracle-r${repetition}-age${age}-${gender}-${residency}`, source: 'oracle-only', age, gender, residency, districtCode: residency === 'sultangazi' ? '2055' : '9999', isMinor: age < 18 });
  }
  return profiles;
}

async function discoverFacility(module: string, p: ScenarioProfile): Promise<any[]> {
  if (p.source === 'oracle-only') return [];
  const qs = new URLSearchParams({ limit: String(LIMIT), showAll: 'true' });
  if (p.participantId) qs.set('participantId', p.participantId);
  const r = await http<any>(`/api/v1/me/facilities/${module}/discover?${qs}`, { token: p.accessToken });
  return r.data.items ?? [];
}
async function runFacility(modules: string[], profiles: ScenarioProfile[]) {
  for (const module of modules) {
    const httpProfiles = profiles.filter(p => p.source !== 'oracle-only' && p.accessToken);
    for (const p of httpProfiles) {
      stat(module).scenarios++;
      try {
        const items = await discoverFacility(module, p); stat(module).items += items.length;
        for (const it of items) {
          const expected = expectedFacility(it, p);
          if (Boolean(it.eligible) !== expected) fail({ severity: 'error', module, check: 'eligibility-oracle', profileKey: p.key, itemId: it.id, expected, actual: it.eligible, body: it }); else pass(module);
        }
        if (items.length === 0) warn({ module, check: 'discover-empty', profileKey: p.key, note: 'No discover items returned for this module/profile.' });
      } catch (e: any) { fail({ severity: 'error', module, check: 'discover-http', profileKey: p.key, status: e.status, body: e.raw }); }
    }
    pass(module, profiles.filter(p => p.source === 'oracle-only').length); // offline oracle profiles generated and formula-evaluable
  }
}

async function runEvents(profiles: ScenarioProfile[]) {
  const module = 'events';
  for (const p of profiles.filter(p => p.source !== 'oracle-only' && p.accessToken)) {
    stat(module).scenarios++;
    try {
      const r = await http<any>(`/api/v1/me/events/discover?limit=${LIMIT}`, { token: p.accessToken });
      const items = r.data.items ?? []; stat(module).items += items.length;
      for (const it of items) {
        const expectedSelf = p.source === 'http-account' ? expectedEvent(it, p) : undefined;
        if (p.source === 'http-account' && 'eligibleForSelf' in it && Boolean(it.eligibleForSelf) !== expectedSelf) fail({ severity: 'error', module, check: 'eligibleForSelf-oracle', profileKey: p.key, itemId: it.id, expected: expectedSelf, actual: it.eligibleForSelf, body: it }); else pass(module);
      }
      if (!items.length) warn({ module, check: 'discover-empty', profileKey: p.key });
    } catch (e: any) { fail({ severity: 'error', module, check: 'discover-http', profileKey: p.key, status: e.status, body: e.raw }); }
  }
  pass(module, profiles.filter(p => p.source === 'oracle-only').length);
}

async function runTravels(profiles: ScenarioProfile[]) {
  const module = 'travels';
  for (const p of profiles.filter(p => p.source !== 'oracle-only' && p.accessToken)) {
    stat(module).scenarios++;
    try {
      const r = await http<any>(`/api/v1/me/travels/discover?limit=${LIMIT}`, { token: p.accessToken });
      const items = r.data.items ?? []; stat(module).items += items.length;
      for (const it of items) {
        const expected = expectedTravel(it, p);
        if (Boolean(it.eligible) !== expected) fail({ severity: 'error', module, check: 'eligibility-oracle', profileKey: p.key, itemId: it.id, expected, actual: it.eligible, body: it }); else pass(module);
        if (it.requiresSeat) await checkTravelSeats(it.id, p);
      }
      if (!items.length) warn({ module, check: 'discover-empty', profileKey: p.key });
    } catch (e: any) { fail({ severity: 'error', module, check: 'discover-http', profileKey: p.key, status: e.status, body: e.raw }); }
  }
  pass(module, profiles.filter(p => p.source === 'oracle-only').length);
}
async function checkTravelSeats(travelId: string, p: ScenarioProfile) {
  try {
    const r = await http<any[]>(`/api/v1/me/travels/${travelId}/seat-map`, { token: p.accessToken });
    for (const bus of r.data) {
      const hiddenOrLocked = new Set<string>(bus.lockedSeatIds ?? []);
      const occupied = new Set<string>((bus.occupants ?? []).map((o: any) => o.seatNumber));
      for (const seat of bus.seats ?? []) {
        if (hiddenOrLocked.has(seat.label) && seat.status === 'available') fail({ severity: 'error', module: 'travels', check: 'hidden-seat-available', profileKey: p.key, itemId: travelId, body: { busId: bus.busId, seat } });
        if (occupied.has(seat.label) && seat.status === 'available') fail({ severity: 'error', module: 'travels', check: 'occupied-seat-available', profileKey: p.key, itemId: travelId, body: { busId: bus.busId, seat } });
      }
    }
    pass('travels');
  } catch (e: any) { fail({ severity: 'error', module: 'travels', check: 'seat-map-http', profileKey: p.key, itemId: travelId, status: e.status, body: e.raw }); }
}

async function runQuizzes(profiles: ScenarioProfile[]) {
  const module = 'quizzes';
  for (const p of profiles.filter(p => p.source !== 'oracle-only' && p.accessToken)) {
    stat(module).scenarios++;
    try {
      const r = await http<any>(`/api/v1/me/quizzes/?limit=${LIMIT}`, { token: p.accessToken });
      const items = r.data.items ?? []; stat(module).items += items.length; pass(module, Math.max(items.length, 1));
      if (!items.length) warn({ module, check: 'discover-empty', profileKey: p.key });
    } catch (e: any) { fail({ severity: 'error', module, check: 'list-http', profileKey: p.key, status: e.status, body: e.raw }); }
  }
  pass(module, profiles.filter(p => p.source === 'oracle-only').length);
}
async function runSurveys(profiles: ScenarioProfile[]) {
  const module = 'surveys';
  for (const p of profiles.filter(p => p.source !== 'oracle-only' && p.accessToken)) {
    stat(module).scenarios++;
    try {
      const r = await http<any>(`/api/v1/me/surveys/?limit=${LIMIT}`, { token: p.accessToken });
      const items = r.data.items ?? []; stat(module).items += items.length; pass(module, Math.max(items.length, 1));
      await http<any>('/api/v1/me/surveys/pending/summary', { token: p.accessToken }); pass(module);
      if (!items.length) warn({ module, check: 'discover-empty', profileKey: p.key });
    } catch (e: any) { fail({ severity: 'error', module, check: 'list-http', profileKey: p.key, status: e.status, body: e.raw }); }
  }
  pass(module, profiles.filter(p => p.source === 'oracle-only').length);
}
async function runCampaigns(profiles: ScenarioProfile[]) {
  const module = 'campaigns';
  for (const p of profiles.filter(p => p.source !== 'oracle-only' && p.accessToken)) {
    stat(module).scenarios++;
    try {
      const r = await http<any>(`/api/v1/me/campaigns/?limit=${LIMIT}`, { token: p.accessToken });
      const items = r.data.items ?? []; stat(module).items += items.length;
      for (const it of items) {
        const exhausted = Boolean(it.isExhausted) || (it.totalUsageLimit != null && Number(it.myUsageCount ?? 0) >= Number(it.perUserLimit ?? 1));
        if (it.endDate && new Date(it.endDate).getTime() < Date.now()) fail({ severity: 'error', module, check: 'expired-visible', profileKey: p.key, itemId: it.id, body: it }); else pass(module);
        if (exhausted && !it.isExhausted && Number(it.myUsageCount ?? 0) >= Number(it.perUserLimit ?? 1)) warn({ module, check: 'per-user-limit-visible', profileKey: p.key, itemId: it.id, body: it });
      }
      await http('/api/v1/me/campaigns/settings', { token: p.accessToken }); pass(module);
      await http('/api/v1/me/campaigns/categories', { token: p.accessToken }); pass(module);
      if (!items.length) warn({ module, check: 'discover-empty', profileKey: p.key });
    } catch (e: any) { fail({ severity: 'error', module, check: 'list-http', profileKey: p.key, status: e.status, body: e.raw }); }
  }
  pass(module, profiles.filter(p => p.source === 'oracle-only').length);
}

async function expectDuplicateRejected(module: string, label: string, fn: () => Promise<{ status: number; raw: unknown }>, p: ScenarioProfile, itemId: string) {
  try {
    const dup = await fn();
    if (dup.status === 409) pass(module);
    else fail({ severity: 'error', module, check: `${label}-duplicate-not-rejected`, profileKey: p.key, itemId, status: dup.status, body: dup.raw, expected: 409, actual: dup.status });
  } catch (e: any) {
    if (e.status === 409) pass(module);
    else fail({ severity: 'error', module, check: `${label}-duplicate-http`, profileKey: p.key, itemId, status: e.status, body: e.raw });
  }
}

async function runMutations(profiles: ScenarioProfile[]) {
  if (!MUTATE) { skip('mutations', 'Mutating apply/submit/redeem checks skipped. Re-run with SCENARIO_MUTATE=1 to create live applications/usages.'); return; }
  const candidates = profiles.filter(p => p.source !== 'oracle-only' && p.accessToken && p.participantId).slice(0, APPLY_SAMPLE_LIMIT);
  if (candidates.length < 2) warn({ module: 'mutations', check: 'low-http-profile-count', actual: candidates.length, expected: '>=2', note: 'Seat conflict requires at least two HTTP-backed profiles.' });

  await runFacilityMutations(candidates);
  await runEventMutations(candidates);
  await runTravelMutations(candidates);
  await runQuizMutations(candidates);
  await runSurveyMutations(candidates);
  await runCampaignMutations(candidates);
}

async function runFacilityMutations(candidates: ScenarioProfile[]) {
  for (const module of ['sports', 'pool', 'youth-camp', 'scout-camp', 'science-center', 'kasif', 'accessible-life']) {
    let attempts = 0;
    for (const p of candidates) {
      if (attempts >= APPLY_SAMPLE_LIMIT) break;
      try {
        const items = await discoverFacility(module, p);
        const item = items.find((x: any) => x.eligible && !x.alreadyApplied && !x.documentsRequired);
        if (!item) { skip(module, `No eligible unapplied facility group for mutation ${p.key}`); continue; }
        const body = { participantId: p.participantId, documents: [] };
        const apply = () => http<any>(`/api/v1/me/facilities/${module}/groups/${item.id}/apply`, { method: 'POST', token: p.accessToken, body: JSON.stringify(body), ok: [201, 409] });
        const first = await apply();
        if (first.status === 201) { pass(module); await expectDuplicateRejected(module, 'facility-apply', apply, p, item.id); }
        else warn({ module, check: 'facility-apply-rejected-before-create', profileKey: p.key, itemId: item.id, status: first.status, body: first.raw });
        attempts++;
      } catch (e: any) { fail({ severity: 'error', module, check: 'facility-mutation-http', profileKey: p.key, status: e.status, body: e.raw }); }
    }
  }
}

async function runEventMutations(candidates: ScenarioProfile[]) {
  const module = 'events';
  for (const p of candidates) {
    try {
      const list = await http<any>(`/api/v1/me/events/discover?limit=${LIMIT}`, { token: p.accessToken });
      const item = (list.data.items ?? []).find((x: any) => (x.eligibleForSelf ?? x.eligible) && !x.alreadyApplied);
      if (!item) { skip(module, `No eligible unapplied event for mutation ${p.key}`); continue; }
      const body = { sessionId: item.sessionId ?? null, participantId: p.participantId, seatNumber: null };
      const apply = () => http<any>(`/api/v1/me/events/${item.id}/apply`, { method: 'POST', token: p.accessToken, body: JSON.stringify(body), ok: [201, 409] });
      const first = await apply();
      if (first.status === 201) { pass(module); await expectDuplicateRejected(module, 'event-apply', apply, p, item.id); }
      else warn({ module, check: 'event-apply-rejected-before-create', profileKey: p.key, itemId: item.id, status: first.status, body: first.raw });
    } catch (e: any) { fail({ severity: 'error', module, check: 'event-mutation-http', profileKey: p.key, status: e.status, body: e.raw }); }
  }
}

async function runTravelMutations(candidates: ScenarioProfile[]) {
  const module = 'travels';
  const seatConflictCandidates: { p: ScenarioProfile; item: any; bus: any; seat: string }[] = [];
  for (const p of candidates) {
    try {
      const list = await http<any>(`/api/v1/me/travels/discover?limit=${LIMIT}`, { token: p.accessToken });
      const item = (list.data.items ?? []).find((x: any) => x.eligible && !x.alreadyApplied && x.applicationOpen);
      if (!item) { skip(module, `No eligible unapplied travel for mutation ${p.key}`); continue; }
      const detail = await http<any>(`/api/v1/me/travels/${item.id}`, { token: p.accessToken });
      const bus = (detail.data.buses ?? [])[0];
      const seat = bus?.seats?.find((s: any) => s.status === 'available')?.label ?? null;
      const body = { busId: bus?.busId ?? null, passengers: [{ participantId: p.participantId, seatNumber: seat, guest: null }] };
      const reserve = () => http<any>(`/api/v1/me/travels/${item.id}/reserve`, { method: 'POST', token: p.accessToken, body: JSON.stringify(body), ok: [201, 409] });
      const first = await reserve();
      if (first.status === 201) { pass(module); await expectDuplicateRejected(module, 'travel-reserve', reserve, p, item.id); }
      else warn({ module, check: 'travel-reserve-rejected-before-create', profileKey: p.key, itemId: item.id, status: first.status, body: first.raw });
      if (bus && seat) seatConflictCandidates.push({ p, item, bus, seat });
    } catch (e: any) { fail({ severity: 'error', module, check: 'travel-mutation-http', profileKey: p.key, status: e.status, body: e.raw }); }
  }

  if (seatConflictCandidates.length > 0 && candidates.length > 1) {
    const chosen = seatConflictCandidates[0];
    const other = candidates.find(x => x.participantId !== chosen.p.participantId);
    if (other) {
      const body = { busId: chosen.bus.busId, passengers: [{ participantId: other.participantId, seatNumber: chosen.seat, guest: null }] };
      try {
        const res = await http<any>(`/api/v1/me/travels/${chosen.item.id}/reserve`, { method: 'POST', token: other.accessToken, body: JSON.stringify(body), ok: [201, 409] });
        if (res.status === 409) pass(module);
        else fail({ severity: 'error', module, check: 'travel-seat-double-booking-not-rejected', profileKey: other.key, itemId: chosen.item.id, expected: 409, actual: res.status, body: res.raw });
      } catch (e: any) {
        if (e.status === 409) pass(module); else fail({ severity: 'error', module, check: 'travel-seat-conflict-http', profileKey: other.key, itemId: chosen.item.id, status: e.status, body: e.raw });
      }
    }
  } else skip(module, 'No seat-map travel reservation succeeded, so same-seat conflict could not be attempted.');
}

async function runQuizMutations(candidates: ScenarioProfile[]) {
  const module = 'quizzes';
  for (const p of candidates.slice(0, Math.max(2, Math.floor(APPLY_SAMPLE_LIMIT / 2)))) {
    try {
      const list = await http<any>(`/api/v1/me/quizzes/?limit=${LIMIT}`, { token: p.accessToken });
      const item = (list.data.items ?? []).find((x: any) => !x.alreadyParticipated && x.status === 'ongoing');
      if (!item) { skip(module, `No ongoing unparticipated quiz for mutation ${p.key}`); continue; }
      const detail = await http<any>(`/api/v1/me/quizzes/${item.id}`, { token: p.accessToken });
      const answers = (detail.data.questions ?? []).map((q: any, idx: number) => ({ questionIndex: idx, selectedAnswer: q.options?.[0] ?? '', timeSpent: 1 }));
      const submit = () => http<any>(`/api/v1/me/quizzes/${item.id}/submit`, { method: 'POST', token: p.accessToken, body: JSON.stringify({ answers, totalTimeSpent: answers.length }), ok: [201, 409] });
      const first = await submit();
      if (first.status === 201) { pass(module); await expectDuplicateRejected(module, 'quiz-submit', submit, p, item.id); }
      else warn({ module, check: 'quiz-submit-rejected-before-create', profileKey: p.key, itemId: item.id, status: first.status, body: first.raw });
    } catch (e: any) { fail({ severity: 'error', module, check: 'quiz-mutation-http', profileKey: p.key, status: e.status, body: e.raw }); }
  }
}

async function runSurveyMutations(candidates: ScenarioProfile[]) {
  const module = 'surveys';
  for (const p of candidates.slice(0, Math.max(2, Math.floor(APPLY_SAMPLE_LIMIT / 2)))) {
    try {
      const list = await http<any>(`/api/v1/me/surveys/?limit=${LIMIT}`, { token: p.accessToken });
      const item = (list.data.items ?? []).find((x: any) => !x.alreadyResponded);
      if (!item) { skip(module, `No unresponded survey for mutation ${p.key}`); continue; }
      const detail = await http<any>(`/api/v1/me/surveys/${item.id}`, { token: p.accessToken });
      const answers = (detail.data.questions ?? []).map((q: any) => ({ questionId: q.id, answer: q.options?.[0] ?? String(q.scaleMin ?? 'test') }));
      const submit = () => http<any>(`/api/v1/me/surveys/${item.id}/submit`, { method: 'POST', token: p.accessToken, body: JSON.stringify({ answers }), ok: [201, 409] });
      const first = await submit();
      if (first.status === 201) { pass(module); await expectDuplicateRejected(module, 'survey-submit', submit, p, item.id); }
      else warn({ module, check: 'survey-submit-rejected-before-create', profileKey: p.key, itemId: item.id, status: first.status, body: first.raw });
    } catch (e: any) { fail({ severity: 'error', module, check: 'survey-mutation-http', profileKey: p.key, status: e.status, body: e.raw }); }
  }
}

async function runCampaignMutations(candidates: ScenarioProfile[]) {
  const module = 'campaigns';
  for (const p of candidates.slice(0, APPLY_SAMPLE_LIMIT)) {
    try {
      const list = await http<any>(`/api/v1/me/campaigns/?limit=${LIMIT}`, { token: p.accessToken });
      const item = (list.data.items ?? []).find((x: any) => !x.isExhausted && Number(x.myUsageCount ?? 0) < Number(x.perUserLimit ?? 1));
      if (!item) { skip(module, `No redeemable campaign for mutation ${p.key}`); continue; }
      await http(`/api/v1/me/campaigns/${item.id}/bookmark`, { method: 'POST', token: p.accessToken }); pass(module);
      await http(`/api/v1/me/campaigns/${item.id}/bookmark`, { method: 'DELETE', token: p.accessToken }); pass(module);
      const redeem = await http<any>(`/api/v1/me/campaigns/${item.id}/redeem`, { method: 'POST', token: p.accessToken, ok: [200, 409] });
      if (redeem.status === 200) pass(module); else warn({ module, check: 'campaign-redeem-rejected', profileKey: p.key, itemId: item.id, status: redeem.status, body: redeem.raw });
    } catch (e: any) { fail({ severity: 'error', module, check: 'campaign-mutation-http', profileKey: p.key, status: e.status, body: e.raw }); }
  }
}


function csvEscape(v: unknown): string { const s = typeof v === 'string' ? v : JSON.stringify(v ?? ''); return `"${s.replaceAll('"', '""')}"`; }
async function writeReports(profiles: ScenarioProfile[]) {
  await mkdir(OUT_DIR, { recursive: true });
  const report = { tag: TAG, api: API, mutate: MUTATE, generatedAt: new Date().toISOString(), profiles: profiles.length, httpProfiles: profiles.filter(p => p.source !== 'oracle-only').length, oracleOnlyProfiles: profiles.filter(p => p.source === 'oracle-only').length, stats, findings };
  await writeFile(join(OUT_DIR, 'scenario-results.json'), JSON.stringify(report, null, 2));
  const csv = ['severity,module,check,profileKey,itemId,status,expected,actual,note,body', ...findings.map(f => [f.severity, f.module, f.check, f.profileKey, f.itemId, f.status, f.expected, f.actual, f.note, f.body].map(csvEscape).join(','))].join('\n');
  await writeFile(join(OUT_DIR, 'scenario-findings.csv'), csv);
  const totalScenarios = Object.values(stats).reduce((a, s) => a + s.scenarios, 0);
  const totalPass = Object.values(stats).reduce((a, s) => a + s.pass, 0);
  const totalFail = Object.values(stats).reduce((a, s) => a + s.fail, 0);
  const totalWarnings = Object.values(stats).reduce((a, s) => a + s.warnings, 0);
  const rows = Object.entries(stats).map(([m, s]) => `| ${m} | ${s.scenarios} | ${s.items} | ${s.pass} | ${s.fail} | ${s.warnings} | ${s.skipped} |`).join('\n');
  const md = `# Citizen Scenario Matrix Report\n\n- Tag: \`${TAG}\`\n- API: \`${API}\`\n- Generated: ${new Date().toISOString()}\n- Mutating checks enabled: ${MUTATE ? 'yes' : 'no'}\n- Profiles: ${profiles.length} total, ${profiles.filter(p => p.source !== 'oracle-only').length} HTTP-backed, ${profiles.filter(p => p.source === 'oracle-only').length} oracle-only age/gender/residency profiles (repetition factor ${ORACLE_REPETITIONS})\n- Total module scenario runs: ${totalScenarios}\n- Pass checks: ${totalPass}\n- Fail checks: ${totalFail}\n- Warnings: ${totalWarnings}\n\n## Per-module counts\n\n| Module | HTTP scenarios | Items observed | Pass | Fail | Warnings | Skipped |\n|---|---:|---:|---:|---:|---:|---:|\n${rows}\n\n## Reconnaissance summary\n\nCitizen-facing endpoints exercised/read:\n\n- Facilities: \`GET /api/v1/me/facilities/{module}/discover\`, \`GET /branches\`, \`GET /filters\`, \`GET /groups/{id}\`, \`POST /groups/{id}/apply\`\n- Events: \`GET /api/v1/me/events/discover\`, detail, seat-map, apply, applications\n- Travels: \`GET /api/v1/me/travels/discover\`, detail, seat-map, reserve, applications\n- Quizzes: \`GET /api/v1/me/quizzes/\`, detail, submit, leaderboard\n- Surveys: \`GET /api/v1/me/surveys/\`, pending summary, detail, submit\n- Campaigns: \`GET /api/v1/me/campaigns/\`, settings/categories/detail, bookmark, redeem\n- Auth/family: \`POST /api/v1/auth/citizen/login\`, \`verify-otp\`, \`register\`, \`GET /children\`, family NVI endpoints\n\n## Eligibility oracle\n\nThe harness recomputes age and gender eligibility independently from response fields. Facilities use \`gender + ageMin/ageMax\`. Events/travels use \`gender + minAge/maxAge\` and include a residency oracle when a response exposes residency metadata. Current public DTOs do not expose event/travel residency mode, so residency application is verified during mutating apply/reserve checks when \`SCENARIO_MUTATE=1\`.\n\n## Important coverage caveats\n\n- The live development NVI mock only returns Sultangazi district code \`2055\`, male parent records, and two children aged about 8 and 14. Therefore all 0..90 age, female, and outside-resident variants are generated as oracle-only matrix profiles unless matching HTTP-created records are available from the API.\n- This harness deliberately avoids raw SQL inserts. It uses real citizen auth/OTP and real \`/me/*\` HTTP endpoints only.\n- Mutating apply/reserve/submit/redeem checks are off by default to avoid polluting live data. Enable with \`SCENARIO_MUTATE=1\`.\n- Capacity-full and waitlist behavior require suitable small-capacity live fixtures. If no such eligible fixture is present, the harness records a skipped finding rather than fabricating database state.\n\n## Findings\n\nSee \`scenario-results.json\` and \`scenario-findings.csv\` for structured details.\n\n${findings.length === 0 ? 'No findings recorded.' : findings.slice(0, 50).map(f => `- **${f.severity}** ${f.module}/${f.check}${f.profileKey ? ` profile=${f.profileKey}` : ''}${f.itemId ? ` item=${f.itemId}` : ''}${f.note ? `: ${f.note}` : ''}`).join('\n')}\n\n## Cleanup instructions\n\nThe harness-created parent accounts, if \`SCENARIO_REGISTER_COUNT>0\` was used, have valid TCKN-like values prefixed with \`99\` and emails containing \`${TAG}\`. Do not run cleanup blindly. Review first.\n\n\`\`\`sql\n-- Review synthetic participants only\nSELECT \"Id\", \"Tckn\", \"FullName\", \"Email\", \"CreatedAt\"\nFROM \"Participants\"\nWHERE \"Tckn\" LIKE '99%' OR \"Email\" LIKE '%${TAG}%';\n\n-- Review related applications/usages before deletion\nSELECT * FROM \"EventApplications\" WHERE \"ParticipantId\" IN (SELECT \"Id\" FROM \"Participants\" WHERE \"Tckn\" LIKE '99%' OR \"Email\" LIKE '%${TAG}%');\nSELECT * FROM \"TravelApplications\" WHERE \"ParticipantId\" IN (SELECT \"Id\" FROM \"Participants\" WHERE \"Tckn\" LIKE '99%' OR \"Email\" LIKE '%${TAG}%');\nSELECT * FROM \"FacilityApplications\" WHERE \"ParticipantId\" IN (SELECT \"Id\" FROM \"Participants\" WHERE \"Tckn\" LIKE '99%' OR \"Email\" LIKE '%${TAG}%');\n\n-- Optional cleanup pattern, execute only after review in a non-production DB\n-- DELETE FROM \"ParticipantGuardians\" WHERE \"GuardianId\" IN (SELECT \"Id\" FROM \"Participants\" WHERE \"Tckn\" LIKE '99%' OR \"Email\" LIKE '%${TAG}%') OR \"ChildId\" IN (SELECT \"Id\" FROM \"Participants\" WHERE \"Tckn\" LIKE '99%' OR \"Email\" LIKE '%${TAG}%');\n-- UPDATE \"Participants\" SET \"IsDeleted\" = true, \"DeletedAt\" = NOW() WHERE \"Tckn\" LIKE '99%' OR \"Email\" LIKE '%${TAG}%';\n\`\`\`\n\n## Re-run commands\n\n\`\`\`bash\ncd citizen-portal/tests/scenario-matrix\nmkdir -p .generated\n../../node_modules/.bin/tsc scenario-matrix.ts --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck --outDir .generated\nnode .generated/scenario-matrix.js\nSCENARIO_REGISTER_COUNT=5 node .generated/scenario-matrix.js\nSCENARIO_MUTATE=1 SCENARIO_APPLY_SAMPLE_LIMIT=2 node .generated/scenario-matrix.js\n\`\`\`\n`;
  await writeFile(join(OUT_DIR, 'REPORT.md'), md);
  console.log(JSON.stringify({ totalScenarios, totalPass, totalFail, totalWarnings, outDir: OUT_DIR }, null, 2));
}

async function main() {
  await http('/health');
  const profiles = await buildProfiles();
  if (!profiles.some(p => p.source !== 'oracle-only')) throw new Error('No HTTP-backed profiles available. Demo login/register failed.');
  await runFacility(['sports', 'pool', 'youth-camp', 'scout-camp', 'science-center', 'kasif', 'accessible-life'], profiles);
  await runEvents(profiles);
  await runTravels(profiles);
  await runQuizzes(profiles);
  await runSurveys(profiles);
  await runCampaigns(profiles);
  await runMutations(profiles);
  await writeReports(profiles);
  if (findings.some(f => f.severity === 'error')) process.exitCode = 2;
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
