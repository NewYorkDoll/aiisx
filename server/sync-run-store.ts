import { randomUUID } from 'node:crypto'
import type { Row } from '@libsql/client'
import type { SyncRun, SyncRunItem } from '../shared/types.js'
import { database, ensureDatabaseSchema } from './database.js'

export type SyncTrigger = SyncRun['trigger']
export type StoredSyncResult = {
  platform: string
  status: SyncRunItem['status']
  durationMs: number
  message?: string
}

function mapItem(row: Row): SyncRunItem {
  return {
    id: String(row.id),
    platform: String(row.platform),
    status: String(row.status) as SyncRunItem['status'],
    startedAt: String(row.started_at),
    completedAt: row.completed_at === null ? null : String(row.completed_at),
    durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
    message: row.message === null ? null : String(row.message),
  }
}

function mapRun(row: Row, items: SyncRunItem[]): SyncRun {
  return {
    id: String(row.id),
    trigger: String(row.trigger) as SyncRun['trigger'],
    slot: row.slot === null ? null : String(row.slot),
    status: String(row.status) as SyncRun['status'],
    startedAt: String(row.started_at),
    completedAt: row.completed_at === null ? null : String(row.completed_at),
    durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
    succeeded: Number(row.succeeded_count),
    failed: Number(row.failed_count),
    items,
  }
}

export async function startSyncRun(trigger: SyncTrigger, slot: string | null, platforms: string[]) {
  await ensureDatabaseSchema()
  const id = randomUUID()
  const startedAt = new Date().toISOString()
  const itemIds = new Map(platforms.map((platform) => [platform, randomUUID()]))
  await database.batch([
    {
      sql: `INSERT INTO sync_runs
        (id, trigger, slot, status, started_at, succeeded_count, failed_count)
        VALUES (?, ?, ?, 'running', ?, 0, 0)`,
      args: [id, trigger, slot, startedAt],
    },
    ...platforms.map((platform) => ({
      sql: `INSERT INTO sync_run_items
        (id, run_id, platform, status, started_at)
        VALUES (?, ?, ?, 'running', ?)`,
      args: [itemIds.get(platform)!, id, platform, startedAt],
    })),
  ], 'write')
  return { id, itemIds, startedAt }
}

export async function finishSyncItem(itemId: string, result: StoredSyncResult) {
  const completedAt = new Date().toISOString()
  await database.execute({
    sql: `UPDATE sync_run_items
      SET status = ?, completed_at = ?, duration_ms = ?, message = ?
      WHERE id = ?`,
    args: [result.status, completedAt, result.durationMs, result.message || null, itemId],
  })
}

export async function finishSyncRun(id: string, startedAt: string, results: StoredSyncResult[]) {
  const completedAt = new Date().toISOString()
  const succeeded = results.filter((result) => result.status === 'success').length
  const failed = results.filter((result) => result.status === 'failed').length
  const status: SyncRun['status'] = failed === 0 ? 'success' : succeeded === 0 ? 'failed' : 'partial'
  await database.execute({
    sql: `UPDATE sync_runs
      SET status = ?, completed_at = ?, duration_ms = ?, succeeded_count = ?, failed_count = ?
      WHERE id = ?`,
    args: [status, completedAt, Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)), succeeded, failed, id],
  })
}

export async function listSyncRuns(limit = 12) {
  await ensureDatabaseSchema()
  const safeLimit = Math.min(50, Math.max(1, Math.trunc(limit)))
  const runResult = await database.execute({ sql: 'SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT ?', args: [safeLimit] })
  if (!runResult.rows.length) return []
  const runIds = runResult.rows.map((row) => String(row.id))
  const placeholders = runIds.map(() => '?').join(', ')
  const itemResult = await database.execute({
    sql: `SELECT * FROM sync_run_items WHERE run_id IN (${placeholders}) ORDER BY started_at, platform`,
    args: runIds,
  })
  const itemsByRun = new Map<string, SyncRunItem[]>()
  for (const row of itemResult.rows) {
    const runId = String(row.run_id)
    const items = itemsByRun.get(runId) || []
    items.push(mapItem(row))
    itemsByRun.set(runId, items)
  }
  return runResult.rows.map((row) => mapRun(row, itemsByRun.get(String(row.id)) || []))
}
