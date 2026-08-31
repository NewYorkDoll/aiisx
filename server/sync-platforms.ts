import 'dotenv/config'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fetchFitnessSnapshot } from './keepstrong'
import { fetchSteamSnapshot } from './steam'
import { fetchXboxSnapshot } from './xbox'
import { closePlatformStore, saveFitnessSnapshot, saveSteamSnapshot, saveXboxSnapshot } from './platform-store'
import { syncGames } from './sync-games'
import { databaseLocation } from './database'

export type SyncResult = { platform: string; ok: boolean; message?: string }

function timestamp() {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date())
}

function elapsed(startedAt: number) {
  const milliseconds = Math.round(performance.now() - startedAt)
  return milliseconds < 1_000 ? `${milliseconds}ms` : `${(milliseconds / 1_000).toFixed(1)}s`
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
    return { platform: 'Steam', ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('Steam', `failed after ${elapsed(startedAt)}: ${message}`)
    return { platform: 'Steam', ok: false, message }
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
    return { platform: 'Xbox', ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('Xbox', `failed after ${elapsed(startedAt)}: ${message}`)
    return { platform: 'Xbox', ok: false, message }
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
    return { platform: 'Fitness', ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('Fitness', `failed after ${elapsed(startedAt)}: ${message}`)
    return { platform: 'Fitness', ok: false, message }
  }
}

async function syncSwitch(): Promise<SyncResult> {
  const startedAt = performance.now()
  try {
    const result = await syncGames((message) => log('Switch', message))
    log('Switch', `done: ${result.inserted} new records from ${result.histories} games (${elapsed(startedAt)})`)
    return { platform: 'Switch', ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('Switch', `failed after ${elapsed(startedAt)}: ${message}`)
    return { platform: 'Switch', ok: false, message }
  }
}

export async function syncPlatforms() {
  const startedAt = performance.now()
  log('Database', `using ${databaseLocation}`)
  const tasks: Array<Promise<SyncResult>> = []
  if (process.env.STEAM_API_KEY && process.env.STEAM_ID) {
    tasks.push(syncSteam())
  } else log('Steam', 'skipped: missing STEAM_API_KEY or STEAM_ID')

  if (process.env.SWITCH_CLIENT_ID && process.env.SWITCH_SESSION_TOKEN) {
    tasks.push(syncSwitch())
  } else log('Switch', 'skipped: missing SWITCH_CLIENT_ID or SWITCH_SESSION_TOKEN')

  tasks.push(syncXbox())

  if (process.env.KEEPSTRONG_API_KEY) {
    tasks.push(syncFitness())
  } else log('Fitness', 'skipped: missing KEEPSTRONG_API_KEY')
  log('Sync', `started ${tasks.length} platform tasks in parallel`)
  const results = await Promise.all(tasks)
  const succeeded = results.filter((result) => result.ok).length
  return { succeeded, failed: results.length - succeeded, duration: elapsed(startedAt), results }
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
  setTimeout(async () => { const result = await syncPlatforms(); log('Sync', `scheduled run finished: ${result.succeeded} succeeded, ${result.failed} failed (${result.duration})`); await schedule() }, Math.max(1_000, next.getTime() - Date.now()))
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
