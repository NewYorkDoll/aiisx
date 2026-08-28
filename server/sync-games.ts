import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import * as cheerio from 'cheerio'
dotenv.config()

type AccessToken = { token_type: string; access_token: string }
type PlayHistory = { titleId: string; titleName: string; imageUrl?: string; lastPlayedAt: string; totalPlayedMinutes: number }

const clientId = process.env.SWITCH_CLIENT_ID
const sessionToken = process.env.SWITCH_SESSION_TOKEN
const databaseUrl = process.env.DATABASE_URL
const userAgent = 'com.nintendo.znej/1.13.0 (Android/7.1.2)'

async function getAccessToken() {
  if (!clientId || !sessionToken) throw new Error('SWITCH_CLIENT_ID and SWITCH_SESSION_TOKEN are required')
  const response = await fetch('https://accounts.nintendo.com/connect/1.0.0/api/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: clientId, session_token: sessionToken, grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer-session-token' }) })
  if (!response.ok) throw new Error(`Nintendo token request failed: ${response.status}`)
  return await response.json() as AccessToken
}

async function getHistory(token: AccessToken) {
  const response = await fetch('https://mypage-api.entry.nintendo.co.jp/api/v1/users/me/play_histories', { headers: { Authorization: `${token.token_type} ${token.access_token}`, 'User-Agent': userAgent } })
  if (!response.ok) throw new Error(`Nintendo history request failed: ${response.status}`)
  return (await response.json() as { playHistories?: PlayHistory[] }).playHistories || []
}

async function getChineseInfo(titleId: string, fallbackName: string, fallbackCover: string | undefined) {
  try {
    const response = await fetch(`https://ec.nintendo.com/apps/${titleId}/HK`, { headers: { 'User-Agent': userAgent } })
    if (!response.ok) return { name: fallbackName, cover: fallbackCover || null }
    const $ = cheerio.load(await response.text())
    return { name: $('.o_c-page-title h1').first().text().trim() || fallbackName, cover: $('.o_c-hero-bg__image-inner img').first().attr('src') || fallbackCover || null }
  } catch {
    return { name: fallbackName, cover: fallbackCover || null }
  }
}

function parseDate(value: string) { return new Date(value.replace(/([+-]\d\d):?\d\d$/, '$1:00')) }

async function syncGames() {
  if (!databaseUrl) throw new Error('DATABASE_URL is required')
  const pool = mysql.createPool(databaseUrl)
  try {
    const token = await getAccessToken()
    const histories = await getHistory(token)
    const [rawRows] = await pool.query('SELECT title_id, SUM(play_time) AS total_play_time, MAX(last_played_at) AS last_played_at FROM dwd_switch_game_played_record GROUP BY title_id')
    const rows = rawRows as Array<{ title_id: string; total_play_time: number; last_played_at: Date }>
    const previous = new Map(rows.map((row) => [row.title_id, row]))
    let inserted = 0
    for (const game of histories) {
      const playedAt = parseDate(game.lastPlayedAt)
      const old = previous.get(game.titleId)
      if (old && old.last_played_at.getTime() === playedAt.getTime()) continue
      const delta = Math.max(0, game.totalPlayedMinutes - Number(old?.total_play_time || 0))
      const info = await getChineseInfo(game.titleId, game.titleName, game.imageUrl)
      await pool.execute('INSERT INTO dwd_switch_game_played_record (title_id, title_name, zh_name, zh_cover, last_played_at, play_time, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())', [game.titleId, game.titleName, info.name, info.cover, playedAt, delta])
      inserted += 1
    }
    console.log(`Synced ${inserted} Switch game records.`)
  } finally {
    await pool.end()
  }
}

syncGames().catch((error) => { console.error(error); process.exitCode = 1 })
