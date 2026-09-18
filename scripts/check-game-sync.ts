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
let shopTitle: string | null = null
let shopRequests = 0
globalThis.fetch = async (input, init) => {
  const url = String(input)
  if (url.startsWith('https://ec.nintendo.com/apps/')) {
    shopRequests += 1
    return new Response(shopTitle ? `<h1>請確認設定。</h1><meta property="og:title" content="${shopTitle}｜下載版軟體｜任天堂"/>` : '<title>任天堂</title>')
  }
  if (url.includes('/api/token')) return Response.json({ token_type: 'Bearer', access_token: 'test-access' })
  if (url.includes('/play_histories')) {
    assert.equal(new Headers(init?.headers).get('gentry-locale'), 'en-US')
    return Response.json(malformed ? {} : { playHistories: [{ titleId: 'switch-game', titleName: 'Example', imageUrl: 'https://atum-img-lp1.cdn.nintendo.net/cover.jpg', lastPlayedAt: '2026-09-17T21:00:00+05:30', totalPlayedMinutes: minutes }], recentPlayHistories: [
      { playedDate: '2026-09-04T00:00:00Z', dailyPlayHistories: [{ titleId: 'switch-game', titleName: 'Example', totalPlayedMinutes: 10 }] },
      { playedDate: '2026-09-05T00:00:00Z', dailyPlayHistories: [{ titleId: 'switch-game', titleName: 'Example', totalPlayedMinutes: 20 }] },
      { playedDate: '2026-09-17T00:00:00Z', dailyPlayHistories: [{ titleId: 'switch-game', titleName: 'Example', totalPlayedMinutes: minutes }] },
    ] })
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
  const { listGames } = await import('../server/db.js')
  const archive = await listGames()
  assert.equal(archive.length, 1)
  assert.equal(archive[0].minutes, 90)
  assert.equal(shopRequests, 1, 'missing shop entries are cached, too')
  shopTitle = '異度神劍2'
  await database.execute('UPDATE dwd_switch_game_played_record SET metadata_checked_at = NULL')
  assert.equal((await syncGames()).inserted, 0, 'localization must not create play activity')
  assert.equal((await listGames())[0].title, shopTitle)
  assert.equal((await database.execute('SELECT title FROM switch_daily_activity ORDER BY played_date LIMIT 1')).rows[0].title, shopTitle)
  assert.equal((await syncGames()).inserted, 0)
  assert.equal(shopRequests, 2, 'names are refreshed independently of play history and then cached')
  shopTitle = null
  await database.execute("UPDATE dwd_switch_game_played_record SET metadata_checked_at = '2000-01-01T00:00:00Z'")
  await syncGames()
  assert.equal((await listGames())[0].title, '異度神劍2', 'a shop failure cannot erase a stored name')
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
    { ...game, titleId: 'console', minutes: 600, cover: 'http://store-images.s-microsoft.com/cover.png', devices: ['XboxSeries'] },
    { ...game, titleId: 'shared', devices: ['PC', 'XboxSeries'] },
  ] })
  const xbox = await getStoredXboxSnapshot()
  assert.deepEqual(xbox?.games.map((item) => item.titleId).sort(), ['console', 'shared'])
  assert.deepEqual(xbox?.games.find((item) => item.titleId === 'shared')?.devices, ['PC', 'XboxSeries'])
  assert.deepEqual(xbox?.pcGames?.map((item) => item.titleId), ['pc'])
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
  const { saveSteamSnapshot } = await import('../server/platform-store.js')
  const { getGameReport } = await import('../server/game-report.js')
  const { mergePcGames } = await import('../shared/pc-library.js')
  const steamGame = { appId: 1, name: 'EXAMPLE', minutes: 30, cover: 'https://cdn.cloudflare.steamstatic.com/cover.jpg', playedAt: '2026-09-17T00:00:00Z' }
  assert.equal(mergePcGames([steamGame], xbox?.pcGames || []).length, 1)
  assert.equal(mergePcGames([{ ...steamGame, playedAt: '2026-09-06T00:00:00Z' }], xbox?.pcGames || [])[0].playedAt, '2026-09-17T00:00:00Z')
  const steamProfile = { name: 'test', avatar: '', state: 0, profileUrl: '' }
  await saveSteamSnapshot({ configured: true, profile: steamProfile, playTimeMinutes: 10, games: [{ ...steamGame, appId: 99, name: 'Stale snapshot' }], fetchedAt: '2026-09-10T00:00:00Z' })
  await saveSteamSnapshot({ configured: true, profile: steamProfile, playTimeMinutes: 30, games: [steamGame], fetchedAt: '2026-09-18T00:00:00Z' })
  const report = await getGameReport(new Date('2026-09-18T00:00:00Z'))
  assert.equal(report.from, '2026-09-05')
  assert.equal(report.to, '2026-09-18')
  assert.equal(report.platforms[0].games[0].minutes, 110)
  assert.equal(report.platforms[0].games[0].timeScope, 'period')
  assert.equal(report.platforms[1].games.length, 1)
  assert.equal(report.platforms[1].games[0].minutes, 30)
  assert.equal(report.platforms[2].games.length, 2)
  assert.equal(report.platforms[2].games[0].timeScope, 'lifetime')
  assert.ok(report.platforms[2].games.some((item) => item.sharedWithPc))
  assert.deepEqual(report.summary, { gameCount: 4, platformCount: 3, periodMinutes: 140, periodGameCount: 2 })
  assert.equal(report.platforms[0].games[0].title, '異度神劍2')
  assert.equal(report.platforms[0].games[0].cover, '/api/games/cover?id=switch%3Aswitch-game')
  assert.equal(report.platforms[1].games[0].cover, '/api/games/cover?id=steam%3A1')
  assert.equal(report.platforms[2].games.find((item) => item.id === 'console')?.cover, '/api/games/cover?id=xbox%3Aconsole')
  assert.deepEqual((await getGameReport(new Date('2027-09-18T00:00:00Z'))).summary, { gameCount: 0, platformCount: 0, periodMinutes: 0, periodGameCount: 0 })
  console.log('Poster: inclusive 14-day boundary, daily upserts, stale Steam exclusion, PC deduplication and time scopes passed')
  let coverRequests = 0
  let coverType = 'image/png'
  let coverSize = 8
  let redirect = false
  globalThis.fetch = async (input, init) => {
    coverRequests += 1
    assert.ok(String(input).startsWith('https://'))
    assert.equal(init?.redirect, 'error')
    if (redirect) throw new TypeError('redirect disallowed')
    return new Response(new Uint8Array(coverSize), { headers: { 'Content-Type': coverType } })
  }
  for (const id of ['switch:switch-game', 'steam:1', 'xbox:console']) {
    const cover = await app.request(`/api/games/cover?id=${encodeURIComponent(id)}`)
    assert.equal(cover.status, 200)
    assert.equal(cover.headers.get('content-type'), 'image/png')
    assert.match(cover.headers.get('cache-control')!, /public/)
    assert.equal((await cover.arrayBuffer()).byteLength, 8)
  }
  assert.equal((await app.request('/api/games/cover?id=https://localhost')).status, 400)
  assert.equal((await app.request('/api/games/cover?id=pc:pc')).status, 404)
  await database.execute("UPDATE steam_game_activity SET cover = 'http://127.0.0.1/private' WHERE app_id = 1")
  assert.equal((await app.request('/api/games/cover?id=steam:1')).status, 404)
  assert.equal(coverRequests, 3, 'only stored official CDN URLs may be fetched')
  coverType = 'image/svg+xml'
  assert.equal((await app.request('/api/games/cover?id=switch:switch-game')).status, 502)
  coverType = 'image/png'
  coverSize = 4 * 1024 * 1024 + 1
  assert.equal((await app.request('/api/games/cover?id=switch:switch-game')).status, 502)
  redirect = true
  const failure = await app.request('/api/games/cover?id=switch:switch-game')
  assert.equal(failure.status, 502)
  assert.equal(failure.headers.get('cache-control'), 'no-store')
  console.log('Covers: all providers, HTTPS, stored-ID lookup, host allowlist, size/type limits and redirect failures passed')
} finally {
  globalThis.fetch = originalFetch
  await closeDatabase()
}
