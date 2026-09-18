import type { GameShareReport } from '../shared/types.js'
import { database, ensureDatabaseSchema } from './database.js'
import { mergePcGames } from '../shared/pc-library.js'

export async function getGameReport(now = new Date()): Promise<GameShareReport> {
  await ensureDatabaseSchema()
  const formatDate = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  const from = formatDate(new Date(now.getTime() - 13 * 86_400_000))
  const to = formatDate(now)
  const start = `${from}T00:00:00+08:00`
  const end = now.toISOString()
  const [switchGames, steamGames, xboxGames, pcGames, sync] = await Promise.all([
    database.execute({ sql: `SELECT title_id, title, SUM(minutes) AS minutes, MAX(played_date) AS played_at
      FROM switch_daily_activity WHERE played_date BETWEEN ? AND ?
      GROUP BY title_id HAVING SUM(minutes) > 0 ORDER BY minutes DESC, title_id`, args: [from, to] }),
    database.execute({ sql: `SELECT app_id, name, cover, minutes, played_at FROM steam_game_activity
      WHERE julianday(played_at) BETWEEN julianday(?) AND julianday(?) AND minutes > 0
        AND synced_at = (SELECT fetched_at FROM steam_profile_snapshot WHERE id = 1)
      ORDER BY minutes DESC, app_id`, args: [start, end] }),
    database.execute({ sql: `SELECT title_id, name, minutes, played_at, achievements, devices FROM xbox_game_activity
      WHERE julianday(played_at) BETWEEN julianday(?) AND julianday(?)
        AND EXISTS (SELECT 1 FROM json_each(devices) WHERE value IN ('Xbox360', 'XboxOne', 'XboxSeries'))
      ORDER BY played_at DESC, title_id`, args: [start, end] }),
    database.execute({ sql: `SELECT title_id, name, cover, minutes, played_at FROM xbox_game_activity
      WHERE julianday(played_at) BETWEEN julianday(?) AND julianday(?)
        AND EXISTS (SELECT 1 FROM json_each(devices) WHERE value IN ('PC', 'Win32'))
        AND NOT EXISTS (SELECT 1 FROM json_each(devices) WHERE value IN ('Xbox360', 'XboxOne', 'XboxSeries'))
      ORDER BY played_at DESC, title_id`, args: [start, end] }),
    database.execute(`SELECT 'Switch' AS platform, MAX(completed_at) AS synced_at FROM sync_run_items WHERE platform = 'Switch' AND status = 'success'
      UNION ALL SELECT 'Steam', fetched_at FROM steam_profile_snapshot WHERE id = 1
      UNION ALL SELECT 'Xbox', fetched_at FROM xbox_profile_snapshot WHERE id = 1`),
  ])
  const syncedAt = (platform: string) => {
    const value = sync.rows.find((row) => row.platform === platform)?.synced_at
    return value ? String(value) : null
  }
  return { from, to, generatedAt: end, platforms: [
    { name: 'Switch', syncedAt: syncedAt('Switch'), games: switchGames.rows.map((row) => ({ id: String(row.title_id), title: String(row.title), playedAt: String(row.played_at), minutes: Number(row.minutes), timeScope: 'period' })) },
    { name: 'PC', syncedAt: [syncedAt('Steam'), syncedAt('Xbox')].filter((value): value is string => Boolean(value)).sort()[0] || null, games: mergePcGames(
      steamGames.rows.map((row) => ({ appId: Number(row.app_id), name: String(row.name), cover: String(row.cover), playedAt: String(row.played_at), minutes: Number(row.minutes) })),
      pcGames.rows.map((row) => ({ titleId: String(row.title_id), name: String(row.name), cover: row.cover ? String(row.cover) : null, playedAt: String(row.played_at), minutes: row.minutes === null ? null : Number(row.minutes), gamerscore: 0, achievements: 0, devices: ['PC'] })),
    ).map((game) => ({ id: game.id, title: game.title, playedAt: game.playedAt!, minutes: game.minutes, timeScope: game.timeScope })) },
    { name: 'Xbox', syncedAt: syncedAt('Xbox'), games: xboxGames.rows.map((row) => ({ id: String(row.title_id), title: String(row.name), playedAt: String(row.played_at), minutes: row.minutes === null ? null : Number(row.minutes), timeScope: 'lifetime', achievements: Number(row.achievements), sharedWithPc: (JSON.parse(String(row.devices)) as string[]).some((device) => device === 'PC' || device === 'Win32') })) },
  ] }
}
