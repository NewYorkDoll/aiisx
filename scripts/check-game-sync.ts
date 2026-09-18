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
  const { isConsoleTitle } = await import('../server/xbox.js')
  const { saveXboxSnapshot, getStoredXboxSnapshot } = await import('../server/platform-store.js')
  assert.equal(isConsoleTitle({ type: 'Game', devices: ['Win32'] }), false)
  assert.equal(isConsoleTitle({ type: 'Game', devices: ['PC'] }), false)
  assert.equal(isConsoleTitle({ type: 'Game', devices: ['XboxSeries', 'PC'] }), true)
  assert.equal(isConsoleTitle({ type: 'App', devices: ['XboxOne'] }), false)
  assert.equal(isConsoleTitle({ type: 'Game' }), false)
  const game = { name: 'Example', playedAt: '2026-09-17T00:00:00Z', cover: null, gamerscore: 0, achievements: 0, minutes: null }
  await saveXboxSnapshot({ configured: true, state: 'Offline', currentGame: null, fetchedAt: '2026-09-18T00:00:00Z', profile: { xuid: 'test', gamertag: 'test', displayName: null, avatar: null, gamerscore: 0 }, games: [
    { ...game, titleId: 'pc', devices: ['Win32'] },
    { ...game, titleId: 'legacy', devices: [] },
    { ...game, titleId: 'console', devices: ['XboxSeries'] },
    { ...game, titleId: 'shared', devices: ['PC', 'XboxSeries'] },
  ] })
  const xbox = await getStoredXboxSnapshot()
  assert.deepEqual(xbox?.games.map((item) => item.titleId).sort(), ['console', 'shared'])
  assert.deepEqual(xbox?.games.find((item) => item.titleId === 'shared')?.devices, ['PC', 'XboxSeries'])
  console.log('Xbox sync: PC-only games and old unclassified rows excluded, shared platform metadata retained')
  const { default: app } = await import('../server/app.js')
  const { createHmac } = await import('node:crypto')
  process.env.ADMIN_TOKEN = 'test-only-admin'
  assert.equal((await app.request('/api/admin/sync', { method: 'POST' })).status, 401)
  const payload = `${Math.floor(Date.now() / 1000)}.${Math.floor(Date.now() / 1000) + 60}`
  const signature = createHmac('sha256', process.env.ADMIN_TOKEN).update(payload).digest('base64url')
  const headers = { Cookie: `aiisx_admin_session=${payload}.${signature}`, 'Content-Type': 'application/json' }
  assert.equal((await app.request('/api/admin/sync', { method: 'POST', headers, body: JSON.stringify({ platforms: ['Other'] }) })).status, 400)
  malformed = false
  const manual = await app.request('/api/admin/sync', { method: 'POST', headers, body: JSON.stringify({ platforms: ['Switch'] }) })
  const result = await manual.json() as { succeeded: number; results: Array<{ platform: string }> }
  assert.equal(result.succeeded, 1)
  assert.deepEqual(result.results.map((item) => item.platform), ['Switch'])
  console.log('Manual recovery: admin auth, platform validation and selected-platform sync passed')
} finally {
  globalThis.fetch = originalFetch
  await closeDatabase()
}
