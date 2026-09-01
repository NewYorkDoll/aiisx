import type { SteamGame, SteamSnapshot } from '../shared/types.js'

type SteamPlayer = { steamid: string; personaname: string; personastate: number; avatarfull: string }
type SteamRawGame = { appid: number; name: string; playtime_2weeks?: number }
type SteamOwnedGame = { appid: number; rtime_last_played?: number }

const cache = new Map<string, { expiresAt: number; value: SteamSnapshot }>()
const cacheTtl = 15 * 60 * 1000

async function steamFetch<T>(path: string, key: string, steamId: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.steampowered.com${path}`)
  url.searchParams.set('key', key)
  url.searchParams.set(path.startsWith('/ISteamUser/') ? 'steamids' : 'steamid', steamId)
  url.searchParams.set('format', 'json')
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value)
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) })
  if (!response.ok) throw new Error(`Steam ${path.split('/').filter(Boolean)[0]} returned ${response.status}`)
  return await response.json() as T
}

function normalizeSteamId(value: string) {
  return value.match(/\d{17}/)?.[0] || null
}

export async function fetchSteamSnapshot(): Promise<SteamSnapshot> {
  const key = process.env.STEAM_API_KEY?.trim()
  const rawSteamId = process.env.STEAM_ID?.trim()
  const steamId = rawSteamId ? normalizeSteamId(rawSteamId) : null
  const fetchedAt = new Date().toISOString()
  if (!key || !rawSteamId) {
    return { configured: false, profile: null, playTimeMinutes: 0, games: [], fetchedAt, message: 'set STEAM_API_KEY and STEAM_ID to connect Steam' }
  }
  if (!steamId) {
    return { configured: true, profile: null, playTimeMinutes: 0, games: [], fetchedAt, message: 'STEAM_ID must contain a 17-digit SteamID64' }
  }

  const cached = cache.get(steamId)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  try {
    const [summary, recent, owned] = await Promise.all([
      steamFetch<{ response?: { players?: SteamPlayer[] } }>('/ISteamUser/GetPlayerSummaries/v0002/', key, steamId),
      steamFetch<{ response?: { games?: SteamRawGame[] } }>('/IPlayerService/GetRecentlyPlayedGames/v0001/', key, steamId),
      steamFetch<{ response?: { games?: SteamOwnedGame[] } }>('/IPlayerService/GetOwnedGames/v0001/', key, steamId, { include_appinfo: 'false', include_played_free_games: 'true' }).catch(() => ({ response: { games: [] } })),
    ])
    const player = summary.response?.players?.[0]
    const lastPlayed = new Map((owned.response?.games || []).map((game) => [game.appid, game.rtime_last_played || 0]))
    const games: SteamGame[] = (recent.response?.games || []).slice(0, 5).map((game) => ({
      appId: game.appid,
      name: game.name,
      minutes: game.playtime_2weeks || 0,
      cover: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`,
      playedAt: lastPlayed.get(game.appid) ? new Date(lastPlayed.get(game.appid)! * 1000).toISOString() : null,
    }))
    const value: SteamSnapshot = {
      configured: true,
      profile: player ? { name: player.personaname, avatar: player.avatarfull, state: player.personastate, profileUrl: `https://steamcommunity.com/profiles/${player.steamid}` } : null,
      playTimeMinutes: games.reduce((total, game) => total + game.minutes, 0),
      games,
      fetchedAt,
    }
    cache.set(steamId, { expiresAt: Date.now() + cacheTtl, value })
    return value
  } catch (error) {
    return { configured: true, profile: null, playTimeMinutes: 0, games: [], fetchedAt, message: error instanceof Error ? error.message : 'Steam API unavailable' }
  }
}
