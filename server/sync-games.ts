import 'dotenv/config'
import * as cheerio from 'cheerio'
import { ProxyAgent, setGlobalDispatcher } from 'undici'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { ensureSwitchSchema } from './db'
import { database } from './database'

if (process.env.HTTPS_PROXY) setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY))

type AccessToken = { token_type: string; access_token: string }
type PlayHistory = { titleId: string; titleName: string; imageUrl?: string; lastPlayedAt: string; totalPlayedMinutes: number }

const clientId = process.env.SWITCH_CLIENT_ID
const sessionToken = process.env.SWITCH_SESSION_TOKEN
const userAgent = 'com.nintendo.znej/1.13.0 (Android/7.1.2)'
const playHistoryUrl = 'https://app-api.znej.nintendo.com/api/v2.0/users/me/play_histories'

type Progress = (message: string) => void

async function request(url: string, init?: RequestInit, onRetry?: (attempt: number) => void) {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) }) }
    catch (error) { lastError = error; if (attempt < 2) { onRetry?.(attempt + 2); await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1))) } }
  }
  const reason = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`Nintendo 请求失败：${url} (${reason})。请检查 HTTPS_PROXY 或更换网络后重试。`, { cause: lastError })
}

async function getAccessToken(progress: Progress) {
  if (!clientId || !sessionToken) throw new Error('SWITCH_CLIENT_ID and SWITCH_SESSION_TOKEN are required')
  const response = await request('https://accounts.nintendo.com/connect/1.0.0/api/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: clientId, session_token: sessionToken, grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer-session-token' }) }, (attempt) => progress(`access token request failed; retrying ${attempt}/3...`))
  if (!response.ok) throw new Error(`Nintendo token request failed: ${response.status}`)
  return await response.json() as AccessToken
}

async function getHistory(token: AccessToken, progress: Progress) {
  const response = await request(playHistoryUrl, { headers: { Authorization: `${token.token_type} ${token.access_token}`, 'User-Agent': userAgent, 'gentry-locale': 'zh-CN' } }, (attempt) => progress(`play history request failed; retrying ${attempt}/3...`))
  if (!response.ok) throw new Error(`Nintendo history request failed: ${response.status}`)
  return (await response.json() as { playHistories?: PlayHistory[] }).playHistories || []
}

async function getChineseInfo(titleId: string, fallbackName: string, fallbackCover: string | undefined) {
  try {
    const response = await request(`https://ec.nintendo.com/apps/${titleId}/HK`, { headers: { 'User-Agent': userAgent } })
    if (!response.ok) return { name: fallbackName, cover: fallbackCover || null }
    const $ = cheerio.load(await response.text())
    return { name: $('.o_c-page-title h1').first().text().trim() || fallbackName, cover: $('.o_c-hero-bg__image-inner img').first().attr('src') || fallbackCover || null }
  } catch {
    return { name: fallbackName, cover: fallbackCover || null }
  }
}

function parseDate(value: string) { return new Date(value.replace(/([+-]\d\d):?\d\d$/, '$1:00')) }

export async function syncGames(progress: Progress = () => undefined) {
  await ensureSwitchSchema()
  progress('requesting Nintendo access token...')
  const token = await getAccessToken(progress)
  progress('access token received; requesting play history...')
  const histories = await getHistory(token, progress)
  progress(`received ${histories.length} play history records; checking database...`)
  const rawRows = await database.execute('SELECT title_id, SUM(play_time) AS total_play_time, MAX(last_played_at) AS last_played_at FROM dwd_switch_game_played_record GROUP BY title_id')
  const previous = new Map(rawRows.rows.map((row) => [String(row.title_id), {
    totalPlayTime: Number(row.total_play_time),
    lastPlayedAt: new Date(String(row.last_played_at)),
  }]))
  let inserted = 0
  for (const [index, game] of histories.entries()) {
    const playedAt = parseDate(game.lastPlayedAt)
    const old = previous.get(game.titleId)
    if (old && old.lastPlayedAt.getTime() === playedAt.getTime()) continue
    const delta = Math.max(0, game.totalPlayedMinutes - (old?.totalPlayTime || 0))
    progress(`processing ${index + 1}/${histories.length}: ${game.titleName}`)
    const info = await getChineseInfo(game.titleId, game.titleName, game.imageUrl)
    const timestamp = new Date().toISOString()
    await database.execute({
      sql: `INSERT INTO dwd_switch_game_played_record
        (title_id, title_name, zh_name, zh_cover, last_played_at, play_time, create_time, update_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [game.titleId, game.titleName, info.name, info.cover, playedAt.toISOString(), delta, timestamp, timestamp],
    })
    inserted += 1
  }
  return { histories: histories.length, inserted }
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isDirectRun) syncGames((message) => console.log(`[Switch] ${message}`)).then((result) => console.log(`Synced ${result.inserted} new Switch records from ${result.histories} games.`)).catch((error) => { console.error(error); process.exitCode = 1 })
