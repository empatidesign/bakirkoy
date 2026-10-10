import { expect, test as base, type WorkerInfo } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { rmdirSync } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'

const workspace = resolve(process.cwd(), '..')
const harness = resolve(workspace, 'e2e-scenarios')
const sessions = new Map<string, AuthSession>()
export const isolatedAuthEnabled = Number(process.env.E2E_ISOLATED_AUTH_WORKERS || 0) > 0

type AuthSession = {
  path: string
  runDirectory: string
  workerIndex: number
  testTag: string
  manifest: { path: string; resources: unknown[]; markDeleted(type: string, id: string): void }
}

function requiredRunId(): string {
  const runId = process.env.E2E_RUN_ID?.trim()
  if (!runId) throw new Error('Missing required test setting: E2E_RUN_ID')
  return runId
}

function referenceDate(runId: string): string {
  const value = runId.slice(0, 8)
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}

export function citizenStorageStatePath(workerIndex: number): string {
  return resolve(tmpdir(), 'nexora-playwright-auth', requiredRunId(), 'citizen', `worker-${workerIndex}`, 'state.json')
}

async function withBootstrapLock<T>(operation: () => Promise<T>): Promise<T> {
  const lock = resolve(tmpdir(), 'nexora-playwright-auth', requiredRunId(), 'bootstrap.lock')
  await mkdir(resolve(lock, '..'), { recursive: true })
  for (let attempt = 0; attempt < 600; attempt++) {
    try {
      await mkdir(lock)
      try { return await operation() }
      finally { await rm(lock, { recursive: true, force: true }) }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await mkdir(resolve(lock, '..'), { recursive: true })
        continue
      }
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      await new Promise(resolveWait => setTimeout(resolveWait, 100))
    }
  }
  throw new Error('Timed out waiting for isolated-auth bootstrap lock')
}

async function freshCitizenToken(client: any, config: any): Promise<string> {
  const login = client.unwrap(await client.post('/auth/login', {
    email: config.adminEmail,
    password: config.adminPassword,
  }))
  if (login?.accessToken) return login.accessToken
  if (!login?.otpSessionToken) throw new Error('bootstrap admin login returned no OTP session')
  const verified = client.unwrap(await client.post('/auth/verify-otp', {
    otpSessionToken: login.otpSessionToken,
    code: config.otpCode,
  }))
  if (!verified?.accessToken) throw new Error('bootstrap admin OTP verification returned no access token')
  return verified.accessToken
}

async function cleanupSession(session: AuthSession): Promise<void> {
  const errors: Error[] = []
  try {
    await withBootstrapLock(async () => {
      const { http, unwrap } = await import('../../../../e2e-scenarios/src/client.mjs')
      const { loadTestConfig } = await import('../../../../e2e-scenarios/src/config.mjs')
      const { cleanupRegisteredResources } = await import('../../../../e2e-scenarios/src/cleanup.mjs')
      const token = await freshCitizenToken({ ...http, unwrap }, loadTestConfig())
      const result = await cleanupRegisteredResources({ delete: (path: string) => http.del(path, token) }, session.manifest)
      for (const failure of result.failures) errors.push(new Error(`${failure.resource.type}:${failure.resource.id}: ${failure.error}`))
      if (result.success) await rm(session.manifest.path, { force: true })
    })
  } catch (error) {
    errors.push(error as Error)
  } finally {
    try { await rm(session.runDirectory, { recursive: true, force: true }) } catch (error) { errors.push(error as Error) }
    for (const directory of [resolve(session.runDirectory, '..'), resolve(session.runDirectory, '../..')]) {
      try { rmdirSync(directory) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOTEMPTY' && (error as NodeJS.ErrnoException).code !== 'ENOENT') errors.push(error as Error) }
    }
    sessions.delete(session.path)
  }
  if (errors.length) throw new AggregateError(errors, 'Citizen isolated-auth teardown failed')
}

export async function citizenStorageState(
  workerInfo: Pick<WorkerInfo, 'workerIndex'>,
  traits: { gender?: 'male' | 'female'; age?: number; neighborhood?: 'Cumhuriyet' | 'Test' } = {},
): Promise<string> {
  const { createRunContext } = await import('../../../../e2e-scenarios/src/run-context.mjs')
  const { createResourceManifest } = await import('../../../../e2e-scenarios/src/resource-manifest.mjs')
  const { createCitizenIdentity } = await import('../../../../e2e-scenarios/src/fixtures/citizen-factory.mjs')
  const { loadTestConfig } = await import('../../../../e2e-scenarios/src/config.mjs')
  const { http, unwrap } = await import('../../../../e2e-scenarios/src/client.mjs')

  const config = loadTestConfig()
  const commitSha = execFileSync('git', ['-C', harness, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const run = createRunContext({ commitSha, workerIndex: workerInfo.workerIndex, module: 'citizen-auth' })
  const manifest = createResourceManifest({ runId: run.runId, artifactsRoot: resolve(harness, '.artifacts') })
  const path = citizenStorageStatePath(workerInfo.workerIndex)
  const session: AuthSession = { path, runDirectory: resolve(path, '..'), workerIndex: workerInfo.workerIndex, testTag: run.testTag, manifest }
  sessions.set(path, session)

  try {
    const identity = await withBootstrapLock(async () => {
      const client = { ...http, unwrap }
      const adminToken = await freshCitizenToken(client, config)
      return createCitizenIdentity({ ...run, referenceDate: referenceDate(run.runId), manifest, config, client, adminToken }, traits)
    })
    const origin = new URL(process.env.BASE_URL?.trim() || 'http://localhost:3110').origin
    await mkdir(session.runDirectory, { recursive: true })
    await writeFile(path, `${JSON.stringify({
      cookies: [],
      origins: [{
        origin,
        localStorage: [
          { name: 'portal_auth_remember', value: '1' },
          { name: 'portal_auth_kind', value: 'citizen' },
          { name: 'nexora_citizen_onboarding_done', value: '1' },
          { name: 'portal_access_token', value: identity.accessToken },
          { name: 'portal_refresh_token', value: identity.refreshToken },
          { name: 'e2e_worker_index', value: String(workerInfo.workerIndex) },
          { name: 'e2e_test_tag', value: run.testTag },
        ],
      }],
    }, null, 2)}\n`, { mode: 0o600 })
    return path
  } catch (error) {
    try { await cleanupSession(session) }
    catch (cleanupError) { throw new AggregateError([error as Error, cleanupError as Error], 'Citizen isolated-auth setup and teardown failed') }
    throw error
  }
}

export async function teardownCitizenStorageState(path: string): Promise<void> {
  const session = sessions.get(path)
  if (session) await cleanupSession(session)
}

export const test = base.extend<{}, { isolatedAuthSession: AuthSession | null }>({
  isolatedAuthSession: [async ({}, use, workerInfo) => {
    if (!isolatedAuthEnabled) {
      await use(null)
      return
    }
    const path = await citizenStorageState(workerInfo)
    const session = sessions.get(path)
    if (!session) throw new Error('Citizen isolated-auth session was not registered')
    let primaryError: unknown
    try { await use(session) } catch (error) { primaryError = error }
    try { await teardownCitizenStorageState(path) }
    catch (error) {
      if (primaryError) throw new AggregateError([primaryError as Error, error as Error], 'Citizen test and teardown failed')
      throw error
    }
    if (primaryError) throw primaryError
  }, { scope: 'worker' }],
  storageState: async ({ isolatedAuthSession }, use) => use(isolatedAuthSession?.path),
})

export { expect }

export async function assertCitizenStateFile(path: string, workerIndex: number): Promise<void> {
  const mode = (await stat(path)).mode & 0o777
  if (mode !== 0o600) throw new Error(`Expected storage state mode 0600, got ${mode.toString(8)}`)
  const state = JSON.parse(await readFile(path, 'utf8'))
  const values = new Map(state.origins[0].localStorage.map((item: { name: string; value: string }) => [item.name, item.value]))
  if (values.get('e2e_worker_index') !== String(workerIndex)) throw new Error('Storage state does not match the runtime worker')
}
