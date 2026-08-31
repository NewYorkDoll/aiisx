import 'dotenv/config'
import mysql, { type RowDataPacket } from 'mysql2/promise'

type TableMigration = { name: string; columns: string[] }

const tables: TableMigration[] = [
  { name: 'journal_posts', columns: ['id', 'slug', 'title', 'content', 'excerpt', 'mood', 'status', 'created_at', 'updated_at', 'published_at'] },
  { name: 'dwd_switch_game_played_record', columns: ['id', 'title_id', 'title_name', 'zh_name', 'zh_cover', 'last_played_at', 'play_time', 'create_time', 'update_time'] },
  { name: 'steam_profile_snapshot', columns: ['id', 'name', 'avatar', 'state', 'profile_url', 'play_time_minutes', 'fetched_at'] },
  { name: 'steam_game_activity', columns: ['app_id', 'name', 'minutes', 'cover', 'synced_at'] },
  { name: 'xbox_profile_snapshot', columns: ['id', 'xuid', 'gamertag', 'display_name', 'avatar', 'gamerscore', 'state', 'current_game', 'fetched_at'] },
  { name: 'xbox_game_activity', columns: ['title_id', 'name', 'played_at', 'cover', 'gamerscore', 'achievements', 'minutes', 'synced_at'] },
  { name: 'fitness_snapshot', columns: ['id', 'weight', 'weight_unit', 'sessions', 'minutes', 'plan_name', 'today_name', 'fetched_at'] },
  { name: 'fitness_recent_action', columns: ['id', 'plan_name', 'action_name', 'session_date', 'set_count', 'action_sequence', 'synced_at'] },
]

function sqliteValue(value: unknown) {
  if (value === undefined || value === null) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number' || typeof value === 'string' || value instanceof Uint8Array) return value
  return String(value)
}

async function migrate() {
  const configuredUrl = process.env.DATABASE_URL?.trim()
  const sourceUrl = process.env.MYSQL_DATABASE_URL?.trim() || (/^mysql:/i.test(configuredUrl || '') ? configuredUrl : undefined)
  if (!sourceUrl) throw new Error('Set MYSQL_DATABASE_URL to the existing MySQL connection string')

  process.env.SQLITE_DATABASE_URL ||= !configuredUrl || /^mysql:/i.test(configuredUrl) ? 'file:./data/aiisx.db' : configuredUrl
  const [{ database, ensureDatabaseSchema, closeDatabase }, source] = await Promise.all([
    import('./database'),
    mysql.createConnection(sourceUrl),
  ])

  try {
    await ensureDatabaseSchema()
    let total = 0
    for (const table of tables) {
      try {
        const [rows] = await source.query<RowDataPacket[]>(`SELECT ${table.columns.map((column) => `\`${column}\``).join(', ')} FROM \`${table.name}\``)
        const statements = rows.map((row) => ({
          sql: `INSERT OR REPLACE INTO ${table.name} (${table.columns.join(', ')}) VALUES (${table.columns.map(() => '?').join(', ')})`,
          args: table.columns.map((column) => sqliteValue(row[column])),
        }))
        for (let index = 0; index < statements.length; index += 100) {
          await database.batch(statements.slice(index, index + 100), 'write')
        }
        total += rows.length
        console.log(`[migrate] ${table.name}: ${rows.length} rows`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (/doesn't exist|Unknown column/i.test(message)) console.log(`[migrate] ${table.name}: skipped (${message})`)
        else throw error
      }
    }
    console.log(`[migrate] complete: ${total} rows copied to ${process.env.SQLITE_DATABASE_URL}`)
  } finally {
    await source.end()
    await closeDatabase()
  }
}

migrate().catch((error) => {
  console.error('[migrate] failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
