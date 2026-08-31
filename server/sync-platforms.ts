import 'dotenv/config'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fetchFitnessSnapshot } from './keepstrong.js'
import { fetchSteamSnapshot } from './steam.js'
import { fetchXboxSnapshot } from './xbox.js'
import { closePlatformStore, saveFitnessSnapshot, saveSteamSnapshot, saveXboxSnapshot } from './platform-store.js'
import { syncGames } from './sync-games.js'
import { databaseLocation } from './database.js'
import { finishSyncItem, finishSyncRun, startSyncRun, type StoredSyncResult, type SyncTrigger } from './sync-run-store.js'

export type SyncResult = StoredSyncResult

function timestamp() {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date())
}

function elapsed(startedAt: number) {
  const milliseconds = duration(startedAt)
  return milliseconds < 1_000 ? `${milliseconds}ms` : `${(milliseconds / 1_000).toFixed(1)}s`
}

function duration(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt))
}

function log(scope: string, message: string) {
  console.log(`[${timestamp()}] ${scope.padEnd(8)} ${message}`)
}

async function syncSteam(): Promise<SyncResult> {
  const startedAt = performance.now()
  log('Steam', 'requesting profile and recent games...')
  try {
    const snapshot = await fetchSteamSnapshot()
    if (snapshot.message) throw new Error(snapshot.message)
    log('Steam', `received ${snapshot.games.length} games; writing database...`)
    await saveSteamSnapshot(snapshot)
    log('Steam', `done: ${snapshot.games.length} games (${elapsed(startedAt)})`)
    return { platform: 'Steam', status: 'success', durationMs: duration(startedAt) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('Steam', `failed after ${elapsed(startedAt)}: ${message}`)
    return { platform: 'Steam', status: 'failed', durationMs: duration(startedAt), message }
  }
}

async function syncXbox(): Promise<SyncResult> {
  const startedAt = performance.now()
  log('Xbox', 'loading token and requesting profile, presence, games...')
  try {
    const snapshot = await fetchXboxSnapshot()
    if (snapshot.message) throw new Error(snapshot.message)
    log('Xbox', `received ${snapshot.games.length} games; writing database...`)
    await saveXboxSnapshot(snapshot)
    log('Xbox', `done: ${snapshot.games.length} games (${elapsed(startedAt)})`)
    return { platform: 'Xbox', status: 'success', durationMs: duration(startedAt) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('Xbox', `failed after ${elapsed(startedAt)}: ${message}`)
    return { platform: 'Xbox', status: 'failed', durationMs: duration(startedAt), message }
  }
}

async function syncFitness(): Promise<SyncResult> {
  const startedAt = performance.now()
  log('Fitness', 'requesting training records and active plan...')
  try {
    const snapshot = await fetchFitnessSnapshot()
    log('Fitness', `received ${snapshot.sessions} sessions and ${snapshot.recentActions.length} recent actions; writing database...`)
    await saveFitnessSnapshot(snapshot)
    log('Fitness', `done: ${snapshot.sessions} sessions (${elapsed(startedAt)})`)
    return { platform: 'Fitness', status: 'success', durationMs: duration(startedAt) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('Fitness', `failed after ${elapsed(startedAt)}: ${message}`)
    return { platform: 'Fitness', status: 'failed', durationMs: duration(startedAt), message }
  }
}

async function syncSwitch(): Promise<SyncResult> {
  const startedAt = performance.now()
  try {
    const result = await syncGames((message) => log('Switch', message))
    log('Switch', `done: ${result.inserted} new records from ${result.histories} games (${elapsed(startedAt)})`)
    return { platform: 'Switch', status: 'success', durationMs: duration(startedAt) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('Switch', `failed after ${elapsed(startedAt)}: ${message}`)
    return { platform: 'Switch', status: 'failed', durationMs: duration(startedAt), message }
  }
}

function skipped(platform: string, message: string): SyncResult {
  log(platform, `skipped: ${message}`)
  return { platform, status: 'skipped', durationMs: 0, message }
}

export async function syncPlatforms(options: { trigger?: SyncTrigger; slot?: string | null } = {}) {
  const startedAt = performance.now()
  log('Database', `using ${databaseLocation}`)
  const tasks: Array<{ platform: string; execute: () => Promise<SyncResult> }> = []
  if (process.env.STEAM_API_KEY && process.env.STEAM_ID) {
    tasks.push({ platform: 'Steam', execute: syncSteam })
  } else tasks.push({ platform: 'Steam', execute: async () => skipped('Steam', 'missing STEAM_API_KEY or STEAM_ID') })

  if (process.env.SWITCH_CLIENT_ID && process.env.SWITCH_SESSION_TOKEN) {
    tasks.push({ platform: 'Switch', execute: syncSwitch })
  } else tasks.push({ platform: 'Switch', execute: async () => skipped('Switch', 'missing SWITCH_CLIENT_ID or SWITCH_SESSION_TOKEN') })

  tasks.push({ platform: 'Xbox', execute: syncXbox })

  if (process.env.KEEPSTRONG_API_KEY) {
    tasks.push({ platform: 'Fitness', execute: syncFitness })
  } else tasks.push({ platform: 'Fitness', execute: async () => skipped('Fitness', 'missing KEEPSTRONG_API_KEY') })
  const run = await startSyncRun(options.trigger || 'manual', options.slot || null, tasks.map((task) => task.platform))
  log('Sync', `started ${tasks.length} platform tasks in parallel`)
  const results = await Promise.all(tasks.map(async (task) => {
    const result = await task.execute()
    await finishSyncItem(run.itemIds.get(task.platform)!, result)
    return result
  }))
  await finishSyncRun(run.id, run.startedAt, results)
  const succeeded = results.filter((result) => result.status === 'success').length
  const failed = results.filter((result) => result.status === 'failed').length
  return { runId: run.id, succeeded, failed, duration: elapsed(startedAt), results }
}

function nextScheduledRun() {
  const now = new Date()
  const times = (process.env.PLATFORM_SYNC_TIMES || '12:00,20:00').split(',').map((value) => value.trim()).map((value) => {
    const [hour, minute] = value.split(':').map(Number)
    return { hour: Number.isFinite(hour) ? hour : 12, minute: Number.isFinite(minute) ? minute : 0 }
  })
  const candidates = times.map(({ hour, minute }) => { const date = new Date(now); date.setHours(hour, minute, 0, 0); return date }).filter((date) => date.getTime() > now.getTime())
  if (candidates.length) return candidates.sort((a, b) => a.getTime() - b.getTime())[0]
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1)
  const first = times.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))[0]
  tomorrow.setHours(first.hour, first.minute, 0, 0)
  return tomorrow
}

async function schedule() {
  const next = nextScheduledRun()
  log('Schedule', `next run: ${next.toLocaleString()}`)
  setTimeout(async () => { const result = await syncPlatforms({ trigger: 'schedule' }); log('Sync', `scheduled run finished: ${result.succeeded} succeeded, ${result.failed} failed (${result.duration})`); await schedule() }, Math.max(1_000, next.getTime() - Date.now()))
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isDirectRun) {
  if (process.argv.includes('--schedule')) {
    schedule().catch((error) => { console.error(error); process.exitCode = 1 })
  } else {
    const startedAt = performance.now()
    syncPlatforms().then(async (result) => {
      log('Database', 'closing connection...')
      await closePlatformStore()
      log('Sync', `complete: ${result.succeeded} succeeded, ${result.failed} failed (${elapsed(startedAt)})`)
    }).catch(async (error) => {
      console.error(error)
      await closePlatformStore().catch(() => undefined)
      process.exitCode = 1
    })
  }
}
