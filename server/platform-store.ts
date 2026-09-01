import type { FitnessSnapshot, SteamSnapshot, XboxSnapshot } from '../shared/types.js'
import { closeDatabase, database, ensureDatabaseSchema } from './database.js'

export async function closePlatformStore() {
  await closeDatabase()
}

export async function saveSteamSnapshot(snapshot: SteamSnapshot) {
  await ensureDatabaseSchema()
  if (!snapshot.profile) return
  const profile = snapshot.profile
  await database.batch([
    {
      sql: `INSERT INTO steam_profile_snapshot
        (id, name, avatar, state, profile_url, play_time_minutes, fetched_at)
        VALUES (1, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name, avatar = excluded.avatar, state = excluded.state,
          profile_url = excluded.profile_url, play_time_minutes = excluded.play_time_minutes,
          fetched_at = excluded.fetched_at`,
      args: [profile.name, profile.avatar, profile.state, profile.profileUrl, snapshot.playTimeMinutes, snapshot.fetchedAt],
    },
    ...snapshot.games.map((game) => ({
      sql: `INSERT INTO steam_game_activity (app_id, name, minutes, cover, played_at, synced_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(app_id) DO UPDATE SET
          name = excluded.name, minutes = excluded.minutes, cover = excluded.cover,
          played_at = excluded.played_at, synced_at = excluded.synced_at`,
      args: [game.appId, game.name, game.minutes, game.cover, game.playedAt, snapshot.fetchedAt],
    })),
  ], 'write')
}

export async function getStoredSteamSnapshot() {
  await ensureDatabaseSchema()
  const profileResult = await database.execute('SELECT name, avatar, state, profile_url, play_time_minutes, fetched_at FROM steam_profile_snapshot WHERE id = 1 LIMIT 1')
  const profile = profileResult.rows[0]
  if (!profile) return null
  const games = await database.execute('SELECT app_id, name, minutes, cover, played_at FROM steam_game_activity ORDER BY played_at DESC, minutes DESC, synced_at DESC LIMIT 5')
  return {
    configured: true,
    profile: {
      name: String(profile.name),
      avatar: profile.avatar === null ? '' : String(profile.avatar),
      state: Number(profile.state),
      profileUrl: String(profile.profile_url),
    },
    playTimeMinutes: Number(profile.play_time_minutes),
    games: games.rows.map((game) => ({ appId: Number(game.app_id), name: String(game.name), minutes: Number(game.minutes), cover: String(game.cover), playedAt: game.played_at === null ? null : String(game.played_at) })),
    fetchedAt: String(profile.fetched_at),
  } satisfies SteamSnapshot
}

export async function saveXboxSnapshot(snapshot: XboxSnapshot) {
  await ensureDatabaseSchema()
  if (!snapshot.profile) return
  const profile = snapshot.profile
  await database.batch([
    {
      sql: `INSERT INTO xbox_profile_snapshot
        (id, xuid, gamertag, display_name, avatar, gamerscore, state, current_game, fetched_at)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          xuid = excluded.xuid, gamertag = excluded.gamertag,
          display_name = excluded.display_name, avatar = excluded.avatar,
          gamerscore = excluded.gamerscore, state = excluded.state,
          current_game = excluded.current_game, fetched_at = excluded.fetched_at`,
      args: [profile.xuid, profile.gamertag, profile.displayName, profile.avatar, profile.gamerscore, snapshot.state, snapshot.currentGame, snapshot.fetchedAt],
    },
    ...snapshot.games.map((game) => ({
      sql: `INSERT INTO xbox_game_activity
        (title_id, name, played_at, cover, gamerscore, achievements, minutes, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(title_id) DO UPDATE SET
          name = excluded.name, played_at = excluded.played_at, cover = excluded.cover,
          gamerscore = excluded.gamerscore, achievements = excluded.achievements,
          minutes = excluded.minutes, synced_at = excluded.synced_at`,
      args: [game.titleId, game.name, game.playedAt, game.cover, game.gamerscore, game.achievements, game.minutes, snapshot.fetchedAt],
    })),
  ], 'write')
}

export async function getStoredXboxSnapshot() {
  await ensureDatabaseSchema()
  const profileResult = await database.execute('SELECT xuid, gamertag, display_name, avatar, gamerscore, state, current_game, fetched_at FROM xbox_profile_snapshot WHERE id = 1 LIMIT 1')
  const profile = profileResult.rows[0]
  if (!profile) return null
  const games = await database.execute('SELECT title_id, name, played_at, cover, gamerscore, achievements, minutes FROM xbox_game_activity ORDER BY played_at DESC, synced_at DESC LIMIT 5')
  return {
    configured: true,
    profile: {
      xuid: String(profile.xuid),
      gamertag: String(profile.gamertag),
      displayName: profile.display_name === null ? null : String(profile.display_name),
      avatar: profile.avatar === null ? null : String(profile.avatar),
      gamerscore: Number(profile.gamerscore),
    },
    state: String(profile.state) as XboxSnapshot['state'],
    currentGame: profile.current_game === null ? null : String(profile.current_game),
    games: games.rows.map((game) => ({
      titleId: String(game.title_id),
      name: String(game.name),
      playedAt: game.played_at === null ? null : String(game.played_at),
      cover: game.cover === null ? null : String(game.cover),
      gamerscore: Number(game.gamerscore),
      achievements: Number(game.achievements),
      minutes: game.minutes === null ? null : Number(game.minutes),
    })),
    fetchedAt: String(profile.fetched_at),
  } satisfies XboxSnapshot
}

export async function saveFitnessSnapshot(snapshot: FitnessSnapshot) {
  await ensureDatabaseSchema()
  await database.batch([
    {
      sql: `INSERT INTO fitness_snapshot
        (id, weight, weight_unit, sessions, minutes, plan_name, today_name, fetched_at)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          weight = excluded.weight, weight_unit = excluded.weight_unit,
          sessions = excluded.sessions, minutes = excluded.minutes,
          plan_name = excluded.plan_name, today_name = excluded.today_name,
          fetched_at = excluded.fetched_at`,
      args: [snapshot.weight, snapshot.weightUnit, snapshot.sessions, snapshot.minutes, snapshot.planName, snapshot.todayName, snapshot.fetchedAt],
    },
    { sql: 'DELETE FROM fitness_recent_action', args: [] },
    ...snapshot.recentActions.map((action) => ({
      sql: `INSERT INTO fitness_recent_action
        (id, plan_name, action_name, session_date, set_count, action_sequence, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [action.id, action.planName, action.actionName, action.date, action.sets, action.sequence, snapshot.fetchedAt],
    })),
  ], 'write')
}

export async function getStoredFitnessSnapshot() {
  await ensureDatabaseSchema()
  const snapshotResult = await database.execute('SELECT weight, weight_unit, sessions, minutes, plan_name, today_name, fetched_at FROM fitness_snapshot WHERE id = 1 LIMIT 1')
  const snapshot = snapshotResult.rows[0]
  if (!snapshot) return null
  const actions = await database.execute('SELECT id, plan_name, action_name, session_date, set_count, action_sequence FROM fitness_recent_action ORDER BY session_date DESC, action_sequence DESC LIMIT 10')
  return {
    weight: null,
    weightUnit: String(snapshot.weight_unit),
    sessions: Number(snapshot.sessions),
    minutes: Number(snapshot.minutes),
    planName: snapshot.plan_name === null ? null : String(snapshot.plan_name),
    todayName: snapshot.today_name === null ? null : String(snapshot.today_name),
    fetchedAt: String(snapshot.fetched_at),
    recentActions: actions.rows.map((action) => ({
      id: String(action.id),
      planName: String(action.plan_name),
      actionName: String(action.action_name),
      date: String(action.session_date),
      sets: Number(action.set_count),
      sequence: Number(action.action_sequence),
    })),
  } satisfies FitnessSnapshot
}
