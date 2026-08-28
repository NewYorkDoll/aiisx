import { drizzle } from 'drizzle-orm/mysql2'
import { mysqlTable, int, varchar, datetime } from 'drizzle-orm/mysql-core'
import { desc } from 'drizzle-orm'
import mysql from 'mysql2/promise'
import type { GameRecord } from '../shared/types'

const gamesTable = mysqlTable('dwd_switch_game_played_record', {
  id: int('id').primaryKey(),
  titleName: varchar('title_name', { length: 255 }).notNull(),
  zhName: varchar('zh_name', { length: 255 }),
  zhCover: varchar('zh_cover', { length: 255 }),
  lastPlayedAt: datetime('last_played_at').notNull(),
  playTime: int('play_time').notNull(),
})

export async function listGames(): Promise<GameRecord[]> {
  const url = process.env.DATABASE_URL
  if (!url) return []
  const pool = mysql.createPool(url)
  try {
    const db = drizzle(pool)
    const rows = await db.select().from(gamesTable).orderBy(desc(gamesTable.lastPlayedAt)).limit(24)
    return rows.map((game) => ({ id: String(game.id), title: game.zhName || game.titleName, cover: game.zhCover, playedAt: game.lastPlayedAt.toISOString(), minutes: game.playTime }))
  } finally {
    await pool.end()
  }
}
