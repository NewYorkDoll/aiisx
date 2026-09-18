import assert from 'node:assert/strict'

process.env.SQLITE_DATABASE_URL = 'file::memory:'
process.env.SWITCH_CLIENT_ID = 'test-client'
process.env.SWITCH_SESSION_TOKEN = 'test-session'
delete process.env.VERCEL
const { database, closeDatabase } = await import('../server/database.js')
const { syncGames } = await import('../server/sync-games.js')
const originalFetch = globalThis.fetch
let minutes = 60
let malformed = false
globalThis.fetch = async (input, init) => {
  const url = String(input)
  if (url.includes('/api/token')) return Response.json({ token_type: 'Bearer', access_token: 'test-access' })
  if (url.includes('/play_histories')) {
    assert.equal(new Headers(init?.headers).get('gentry-locale'), 'en-US')
    return Response.json(malformed ? {} : { playHistories: [{ titleId: 'switch-game', titleName: 'Example', lastPlayedAt: '2026-09-17T21:00:00+05:30', totalPlayedMinutes: minutes }] })
  }
  return new Response('', { status: 404 })
}
try {
  assert.equal((await syncGames()).inserted, 1)
  assert.equal((await syncGames()).inserted, 0)
  minutes = 90
  assert.equal((await syncGames()).inserted, 1)
  const rows = await database.execute('SELECT SUM(play_time) AS minutes, MAX(last_played_at) AS played_at FROM dwd_switch_game_played_record')
  assert.equal(rows.rows[0].minutes, 90)
  assert.equal(rows.rows[0].played_at, '2026-09-17T15:30:00.000Z')
  malformed = true
  await assert.rejects(syncGames(), /missing playHistories/)
  console.log('Switch sync: locale, repeat sync, increasing minutes and invalid responses passed')
} finally {
  globalThis.fetch = originalFetch
  await closeDatabase()
}
