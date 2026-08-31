import { drizzle } from 'drizzle-orm/mysql2'
import { mysqlTable, int, varchar, datetime } from 'drizzle-orm/mysql-core'
import { desc } from 'drizzle-orm'
import mysql, { type Pool } from 'mysql2/promise'
import type { GameRecord } from '../shared/types'

const gamesTable = mysqlTable('dwd_switch_game_played_record', {
  id: int('id').primaryKey(),
  titleName: varchar('title_name', { length: 255 }).notNull(),
  zhName: varchar('zh_name', { length: 255 }),
  zhCover: varchar('zh_cover', { length: 255 }),
  lastPlayedAt: datetime('last_played_at').notNull(),
  playTime: int('play_time').notNull(),
})

export async function ensureSwitchSchema(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS dwd_switch_game_played_record (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title_id VARCHAR(64) NOT NULL,
    title_name VARCHAR(255) NOT NULL,
    zh_name VARCHAR(255) NULL,
    zh_cover VARCHAR(500) NULL,
    last_played_at DATETIME NOT NULL,
    play_time INT NOT NULL DEFAULT 0,
    create_time DATETIME NOT NULL,
    update_time DATETIME NOT NULL,
    INDEX idx_switch_title_id (title_id),
    INDEX idx_switch_last_played_at (last_played_at)
  )`)
}

export async function listGames(): Promise<GameRecord[]> {
  const url = process.env.DATABASE_URL
  if (!url) return []
  const pool = mysql.createPool(url)
  try {
    await ensureSwitchSchema(pool)
    const db = drizzle(pool)
    const rows = await db.select().from(gamesTable).orderBy(desc(gamesTable.lastPlayedAt)).limit(24)
    return rows.map((game) => ({ id: String(game.id), title: game.zhName || game.titleName, cover: game.zhCover, playedAt: game.lastPlayedAt.toISOString(), minutes: game.playTime }))
  } finally {
    await pool.end()
  }
}
