import 'dotenv/config'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createClient } from '@libsql/client'

const configuredUrl = process.env.SQLITE_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim()
const databaseUrl = configuredUrl && !/^mysql:/i.test(configuredUrl) ? configuredUrl : 'file:./data/aiisx.db'

if (process.env.VERCEL && databaseUrl.startsWith('file:')) {
  throw new Error('Vercel requires a remote libSQL DATABASE_URL; local SQLite files are not persistent')
}

if (databaseUrl.startsWith('file:')) {
  const filePath = databaseUrl.slice('file:'.length)
  if (filePath && filePath !== ':memory:') mkdirSync(dirname(resolve(filePath)), { recursive: true })
}

export const database = createClient({
  url: databaseUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
})

export const databaseLocation = databaseUrl.startsWith('file:') ? databaseUrl : new URL(databaseUrl).host

const schema = [
  `CREATE TABLE IF NOT EXISTS journal_posts (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    mood TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    published_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_journal_posts_status_updated
    ON journal_posts (status, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS dwd_switch_game_played_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title_id TEXT NOT NULL,
    title_name TEXT NOT NULL,
    zh_name TEXT,
    zh_cover TEXT,
    last_played_at TEXT NOT NULL,
    play_time INTEGER NOT NULL DEFAULT 0,
    create_time TEXT NOT NULL,
    update_time TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_switch_title_id
    ON dwd_switch_game_played_record (title_id)`,
  `CREATE INDEX IF NOT EXISTS idx_switch_last_played_at
    ON dwd_switch_game_played_record (last_played_at DESC)`,
  `CREATE TABLE IF NOT EXISTS steam_profile_snapshot (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL,
    avatar TEXT,
    state INTEGER NOT NULL,
    profile_url TEXT NOT NULL,
    play_time_minutes INTEGER NOT NULL,
    fetched_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS steam_game_activity (
    app_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    minutes INTEGER NOT NULL,
    cover TEXT NOT NULL,
    synced_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS xbox_profile_snapshot (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    xuid TEXT NOT NULL,
    gamertag TEXT NOT NULL,
    display_name TEXT,
    avatar TEXT,
    gamerscore INTEGER NOT NULL,
    state TEXT NOT NULL,
    current_game TEXT,
    fetched_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS xbox_game_activity (
    title_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    played_at TEXT,
    cover TEXT,
    gamerscore INTEGER NOT NULL,
    achievements INTEGER NOT NULL,
    minutes INTEGER,
    synced_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS xbox_auth (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    encrypted_tokens TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS fitness_snapshot (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    weight REAL,
    weight_unit TEXT NOT NULL,
    sessions INTEGER NOT NULL,
    minutes INTEGER NOT NULL,
    plan_name TEXT,
    today_name TEXT,
    fetched_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS fitness_recent_action (
    id TEXT PRIMARY KEY,
    plan_name TEXT NOT NULL,
    action_name TEXT NOT NULL,
    session_date TEXT NOT NULL,
    set_count INTEGER NOT NULL,
    action_sequence INTEGER NOT NULL,
    synced_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fitness_action_date_sequence
    ON fitness_recent_action (session_date DESC, action_sequence DESC)`,
  `CREATE TABLE IF NOT EXISTS sync_runs (
    id TEXT PRIMARY KEY,
    trigger TEXT NOT NULL CHECK (trigger IN ('manual', 'cron', 'schedule')),
    slot TEXT,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
    started_at TEXT NOT NULL,
    completed_at TEXT,
    duration_ms INTEGER,
    succeeded_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at
    ON sync_runs (started_at DESC)`,
  `CREATE TABLE IF NOT EXISTS sync_run_items (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'skipped')),
    started_at TEXT NOT NULL,
    completed_at TEXT,
    duration_ms INTEGER,
    message TEXT,
    FOREIGN KEY (run_id) REFERENCES sync_runs(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sync_run_items_run
    ON sync_run_items (run_id, started_at)`,
]

let schemaReady: Promise<void> | undefined

export function ensureDatabaseSchema() {
  if (!schemaReady) {
    schemaReady = database.batch(schema.map((sql) => ({ sql, args: [] })), 'write').then(() => undefined)
  }
  return schemaReady
}

export async function closeDatabase() {
  database.close()
}
