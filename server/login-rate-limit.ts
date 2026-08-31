import { database, ensureDatabaseSchema } from './database.js'

const windowMs = 15 * 60 * 1000
const blockMs = 15 * 60 * 1000
const maxAttempts = 5

type AttemptRow = {
  attemptCount: number
  firstAttemptAt: string
  blockedUntil: string | null
}

async function getAttempt(clientKey: string): Promise<AttemptRow | null> {
  await ensureDatabaseSchema()
  const result = await database.execute({
    sql: 'SELECT attempt_count, first_attempt_at, blocked_until FROM auth_login_attempts WHERE client_key = ? LIMIT 1',
    args: [clientKey],
  })
  const row = result.rows[0]
  return row ? {
    attemptCount: Number(row.attempt_count),
    firstAttemptAt: String(row.first_attempt_at),
    blockedUntil: row.blocked_until === null ? null : String(row.blocked_until),
  } : null
}

function retryAfter(blockedUntil: string | null) {
  if (!blockedUntil) return 0
  return Math.max(0, Math.ceil((Date.parse(blockedUntil) - Date.now()) / 1000))
}

export async function getLoginBlock(clientKey: string) {
  const attempt = await getAttempt(clientKey)
  if (!attempt) return 0
  const retry = retryAfter(attempt.blockedUntil)
  if (retry > 0) return retry
  if (Date.now() - Date.parse(attempt.firstAttemptAt) >= windowMs) {
    await clearLoginFailures(clientKey)
  }
  return 0
}

export async function recordLoginFailure(clientKey: string) {
  const existing = await getAttempt(clientKey)
  const now = new Date()
  const inWindow = existing && now.getTime() - Date.parse(existing.firstAttemptAt) < windowMs
  const attemptCount = inWindow ? existing.attemptCount + 1 : 1
  const firstAttemptAt = inWindow ? existing.firstAttemptAt : now.toISOString()
  const blockedUntil = attemptCount >= maxAttempts ? new Date(now.getTime() + blockMs).toISOString() : null
  await database.execute({
    sql: `INSERT INTO auth_login_attempts
      (client_key, attempt_count, first_attempt_at, blocked_until, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(client_key) DO UPDATE SET
        attempt_count = excluded.attempt_count,
        first_attempt_at = excluded.first_attempt_at,
        blocked_until = excluded.blocked_until,
        updated_at = excluded.updated_at`,
    args: [clientKey, attemptCount, firstAttemptAt, blockedUntil, now.toISOString()],
  })
  return { attemptsRemaining: Math.max(0, maxAttempts - attemptCount), retryAfter: retryAfter(blockedUntil) }
}

export async function clearLoginFailures(clientKey: string) {
  await ensureDatabaseSchema()
  await database.execute({ sql: 'DELETE FROM auth_login_attempts WHERE client_key = ?', args: [clientKey] })
}
