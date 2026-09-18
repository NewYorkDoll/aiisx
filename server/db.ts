import type { GameRecord } from '../shared/types.js'
import { database, ensureDatabaseSchema } from './database.js'

export async function ensureSwitchSchema() {
  await ensureDatabaseSchema()
}

export async function listGames(): Promise<GameRecord[]> {
  await ensureDatabaseSchema()
  const result = await database.execute(`
    SELECT id, title_name, zh_name, zh_cover, MAX(last_played_at) AS last_played_at, SUM(play_time) AS play_time
    FROM dwd_switch_game_played_record
    GROUP BY title_id
    ORDER BY last_played_at DESC
    LIMIT 24
  `)

  return result.rows.map((game) => ({
    id: String(game.id),
    title: String(game.zh_name || game.title_name),
    cover: game.zh_cover === null ? null : String(game.zh_cover),
    playedAt: String(game.last_played_at),
    minutes: Number(game.play_time),
  }))
}
