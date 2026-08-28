import mysql from 'mysql2/promise'
import type { FitnessSnapshot, SteamSnapshot, XboxSnapshot } from '../shared/types'

const pool = process.env.DATABASE_URL ? mysql.createPool(process.env.DATABASE_URL) : null
let schemaReady: Promise<void> | null = null
let memorySteam: SteamSnapshot | null = null
let memoryXbox: XboxSnapshot | null = null
let memoryFitness: FitnessSnapshot | null = null

async function ensureSchema() {
  if (!pool) return
  if (!schemaReady) {
    schemaReady = Promise.all([
      pool.query('CREATE TABLE IF NOT EXISTS steam_profile_snapshot (id TINYINT PRIMARY KEY, name VARCHAR(120) NOT NULL, avatar VARCHAR(500) NULL, state INT NOT NULL, profile_url VARCHAR(255) NOT NULL, play_time_minutes INT NOT NULL, fetched_at DATETIME NOT NULL)'),
      pool.query('CREATE TABLE IF NOT EXISTS steam_game_activity (app_id BIGINT PRIMARY KEY, name VARCHAR(255) NOT NULL, minutes INT NOT NULL, cover VARCHAR(500) NOT NULL, synced_at DATETIME NOT NULL)'),
      pool.query('CREATE TABLE IF NOT EXISTS xbox_profile_snapshot (id TINYINT PRIMARY KEY, xuid VARCHAR(32) NOT NULL, gamertag VARCHAR(120) NOT NULL, display_name VARCHAR(120) NULL, avatar VARCHAR(500) NULL, gamerscore INT NOT NULL, state VARCHAR(16) NOT NULL, current_game VARCHAR(255) NULL, fetched_at DATETIME NOT NULL)'),
      pool.query('CREATE TABLE IF NOT EXISTS xbox_game_activity (title_id VARCHAR(128) PRIMARY KEY, name VARCHAR(255) NOT NULL, played_at DATETIME NULL, cover VARCHAR(500) NULL, gamerscore INT NOT NULL, achievements INT NOT NULL, minutes INT NULL, synced_at DATETIME NOT NULL)'),
      pool.query('CREATE TABLE IF NOT EXISTS fitness_snapshot (id TINYINT PRIMARY KEY, weight DECIMAL(6,2) NULL, weight_unit VARCHAR(16) NOT NULL, sessions INT NOT NULL, minutes INT NOT NULL, plan_name VARCHAR(255) NULL, today_name VARCHAR(255) NULL, fetched_at DATETIME NOT NULL)'),
      pool.query('CREATE TABLE IF NOT EXISTS fitness_recent_session (id VARCHAR(128) PRIMARY KEY, name VARCHAR(255) NOT NULL, session_date VARCHAR(32) NOT NULL, sets INT NOT NULL, action_count INT NOT NULL DEFAULT 0, action_names TEXT NULL, synced_at DATETIME NOT NULL)'),
      pool.query('CREATE TABLE IF NOT EXISTS fitness_recent_set (id VARCHAR(128) PRIMARY KEY, plan_name VARCHAR(255) NOT NULL, action_name VARCHAR(255) NOT NULL, session_date VARCHAR(32) NOT NULL, reps VARCHAR(32) NOT NULL, set_number INT NOT NULL, set_sequence INT NOT NULL, synced_at DATETIME NOT NULL)'),
    ]).then(async () => {
      await pool.query('ALTER TABLE xbox_game_activity ADD COLUMN minutes INT NULL').catch(() => undefined)
      await pool.query('ALTER TABLE fitness_recent_session ADD COLUMN action_count INT NOT NULL DEFAULT 0').catch(() => undefined)
      await pool.query('ALTER TABLE fitness_recent_session ADD COLUMN action_names TEXT NULL').catch(() => undefined)
    })
  }
  await schemaReady
}

function asDate(value: string | null) { return value ? new Date(value) : null }
function asIso(value: unknown) { return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString() }

export async function saveSteamSnapshot(snapshot: SteamSnapshot) {
  memorySteam = snapshot
  await ensureSchema()
  if (!pool || !snapshot.profile) return
  const profile = snapshot.profile
  await pool.execute('INSERT INTO steam_profile_snapshot (id, name, avatar, state, profile_url, play_time_minutes, fetched_at) VALUES (1, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), avatar=VALUES(avatar), state=VALUES(state), profile_url=VALUES(profile_url), play_time_minutes=VALUES(play_time_minutes), fetched_at=VALUES(fetched_at)', [profile.name, profile.avatar, profile.state, profile.profileUrl, snapshot.playTimeMinutes, asDate(snapshot.fetchedAt)])
  for (const game of snapshot.games) await pool.execute('INSERT INTO steam_game_activity (app_id, name, minutes, cover, synced_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), minutes=VALUES(minutes), cover=VALUES(cover), synced_at=VALUES(synced_at)', [game.appId, game.name, game.minutes, game.cover, asDate(snapshot.fetchedAt)])
}

export async function getStoredSteamSnapshot() {
  await ensureSchema()
  if (!pool) return memorySteam
  const [profiles] = await pool.query('SELECT name, avatar, state, profile_url, play_time_minutes, fetched_at FROM steam_profile_snapshot WHERE id=1 LIMIT 1')
  const profile = (profiles as Array<{ name: string; avatar: string | null; state: number; profile_url: string; play_time_minutes: number; fetched_at: Date }>)[0]
  if (!profile) return null
  const [games] = await pool.query('SELECT app_id, name, minutes, cover FROM steam_game_activity ORDER BY minutes DESC, synced_at DESC LIMIT 5')
  return { configured: true, profile: { name: profile.name, avatar: profile.avatar || '', state: profile.state, profileUrl: profile.profile_url }, playTimeMinutes: profile.play_time_minutes, games: (games as Array<{ app_id: number; name: string; minutes: number; cover: string }>).map((game) => ({ appId: Number(game.app_id), name: game.name, minutes: game.minutes, cover: game.cover })), fetchedAt: asIso(profile.fetched_at) } satisfies SteamSnapshot
}

export async function saveXboxSnapshot(snapshot: XboxSnapshot) {
  memoryXbox = snapshot
  await ensureSchema()
  if (!pool || !snapshot.profile) return
  const profile = snapshot.profile
  await pool.execute('INSERT INTO xbox_profile_snapshot (id, xuid, gamertag, display_name, avatar, gamerscore, state, current_game, fetched_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE xuid=VALUES(xuid), gamertag=VALUES(gamertag), display_name=VALUES(display_name), avatar=VALUES(avatar), gamerscore=VALUES(gamerscore), state=VALUES(state), current_game=VALUES(current_game), fetched_at=VALUES(fetched_at)', [profile.xuid, profile.gamertag, profile.displayName, profile.avatar, profile.gamerscore, snapshot.state, snapshot.currentGame, asDate(snapshot.fetchedAt)])
  for (const game of snapshot.games) await pool.execute('INSERT INTO xbox_game_activity (title_id, name, played_at, cover, gamerscore, achievements, minutes, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), played_at=VALUES(played_at), cover=VALUES(cover), gamerscore=VALUES(gamerscore), achievements=VALUES(achievements), minutes=VALUES(minutes), synced_at=VALUES(synced_at)', [game.titleId, game.name, asDate(game.playedAt), game.cover, game.gamerscore, game.achievements, game.minutes, asDate(snapshot.fetchedAt)])
}

export async function getStoredXboxSnapshot() {
  await ensureSchema()
  if (!pool) return memoryXbox
  const [profiles] = await pool.query('SELECT xuid, gamertag, display_name, avatar, gamerscore, state, current_game, fetched_at FROM xbox_profile_snapshot WHERE id=1 LIMIT 1')
  const profile = (profiles as Array<{ xuid: string; gamertag: string; display_name: string | null; avatar: string | null; gamerscore: number; state: XboxSnapshot['state']; current_game: string | null; fetched_at: Date }>)[0]
  if (!profile) return null
  const [games] = await pool.query('SELECT title_id, name, played_at, cover, gamerscore, achievements, minutes FROM xbox_game_activity ORDER BY played_at DESC, synced_at DESC LIMIT 5')
  return { configured: true, profile: { xuid: profile.xuid, gamertag: profile.gamertag, displayName: profile.display_name, avatar: profile.avatar, gamerscore: profile.gamerscore }, state: profile.state, currentGame: profile.current_game, games: (games as Array<{ title_id: string; name: string; played_at: Date | null; cover: string | null; gamerscore: number; achievements: number; minutes: number | null }>).map((game) => ({ titleId: game.title_id, name: game.name, playedAt: game.played_at ? asIso(game.played_at) : null, cover: game.cover, gamerscore: game.gamerscore, achievements: game.achievements, minutes: game.minutes === null ? null : Number(game.minutes) })), fetchedAt: asIso(profile.fetched_at) } satisfies XboxSnapshot
}

export async function saveFitnessSnapshot(snapshot: FitnessSnapshot) {
  memoryFitness = snapshot
  await ensureSchema()
  if (!pool) return
  await pool.execute('INSERT INTO fitness_snapshot (id, weight, weight_unit, sessions, minutes, plan_name, today_name, fetched_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE weight=VALUES(weight), weight_unit=VALUES(weight_unit), sessions=VALUES(sessions), minutes=VALUES(minutes), plan_name=VALUES(plan_name), today_name=VALUES(today_name), fetched_at=VALUES(fetched_at)', [snapshot.weight, snapshot.weightUnit, snapshot.sessions, snapshot.minutes, snapshot.planName, snapshot.todayName, asDate(snapshot.fetchedAt)])
  await pool.execute('DELETE FROM fitness_recent_set')
  for (const set of snapshot.recentSets) await pool.execute('INSERT INTO fitness_recent_set (id, plan_name, action_name, session_date, reps, set_number, set_sequence, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [set.id, set.planName, set.actionName, set.date, set.reps, set.setNumber, set.sequence, asDate(snapshot.fetchedAt)])
}

export async function getStoredFitnessSnapshot() {
  await ensureSchema()
  if (!pool) return memoryFitness
  const [rows] = await pool.query('SELECT weight, weight_unit, sessions, minutes, plan_name, today_name, fetched_at FROM fitness_snapshot WHERE id=1 LIMIT 1')
  const row = (rows as Array<{ weight: number | null; weight_unit: string; sessions: number; minutes: number; plan_name: string | null; today_name: string | null; fetched_at: Date }>)[0]
  if (!row) return null
  const [sets] = await pool.query('SELECT id, plan_name, action_name, session_date, reps, set_number, set_sequence FROM fitness_recent_set ORDER BY session_date DESC, set_sequence DESC LIMIT 10')
  return { weight: null, weightUnit: row.weight_unit, sessions: row.sessions, minutes: row.minutes, planName: row.plan_name, todayName: row.today_name, fetchedAt: asIso(row.fetched_at), recentSets: (sets as Array<{ id: string; plan_name: string; action_name: string; session_date: string; reps: string; set_number: number; set_sequence: number }>).map((set) => ({ id: set.id, planName: set.plan_name, actionName: set.action_name, date: set.session_date, reps: set.reps, setNumber: set.set_number, sequence: set.set_sequence })) } satisfies FitnessSnapshot
}
