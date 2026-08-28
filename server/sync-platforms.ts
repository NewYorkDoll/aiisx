import 'dotenv/config'
import { fetchFitnessSnapshot } from './keepstrong'
import { fetchSteamSnapshot } from './steam'
import { fetchXboxSnapshot } from './xbox'
import { saveFitnessSnapshot, saveSteamSnapshot, saveXboxSnapshot } from './platform-store'

async function syncPlatforms() {
  if (!process.env.DATABASE_URL) console.warn('DATABASE_URL is missing: sync results will only live in this process')
  const tasks: Array<Promise<void>> = []
  if (process.env.STEAM_API_KEY && process.env.STEAM_ID) {
    tasks.push(fetchSteamSnapshot().then(async (snapshot) => {
      if (snapshot.message) throw new Error(snapshot.message)
      await saveSteamSnapshot(snapshot)
      console.log(`Steam synced: ${snapshot.games.length} games`)
    }).catch((error) => console.error('Steam sync failed:', error instanceof Error ? error.message : error)))
  } else console.log('Steam sync skipped: missing STEAM_API_KEY or STEAM_ID')

  {
    tasks.push(fetchXboxSnapshot().then(async (snapshot) => {
      if (snapshot.message) throw new Error(snapshot.message)
      await saveXboxSnapshot(snapshot)
      console.log(`Xbox synced: ${snapshot.games.length} games`)
    }).catch((error) => console.error('Xbox sync failed:', error instanceof Error ? error.message : error)))
  } else console.log('Xbox sync skipped: missing XBOX_TOKEN_FILE')

  if (process.env.KEEPSTRONG_API_KEY) {
    tasks.push(fetchFitnessSnapshot().then(async (snapshot) => {
      await saveFitnessSnapshot(snapshot)
      console.log(`Fitness synced: ${snapshot.sessions} sessions`)
    }).catch((error) => console.error('Fitness sync failed:', error instanceof Error ? error.message : error)))
  } else console.log('Fitness sync skipped: missing KEEPSTRONG_API_KEY')
  await Promise.all(tasks)
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
  console.log(`Next platform sync: ${next.toLocaleString()}`)
  setTimeout(async () => { await syncPlatforms(); await schedule() }, Math.max(1_000, next.getTime() - Date.now()))
}

if (process.argv.includes('--schedule')) {
  schedule().catch((error) => { console.error(error); process.exitCode = 1 })
} else {
  syncPlatforms().catch((error) => { console.error(error); process.exitCode = 1 })
}
