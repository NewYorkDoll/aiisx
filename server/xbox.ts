import { Msal, TokenStore } from 'xal-node'
import type { XboxGame, XboxSnapshot } from '../shared/types'

type WebToken = { data: { Token: string; DisplayClaims: { xui: Array<{ uhs: string }> } } }
type Profile = { id: string; settings?: Array<{ id: string; value: string }> }
type ProfileResponse = { profileUsers?: Profile[] }
type PresenceResponse = { state?: 'Online' | 'Offline'; devices?: Array<{ titles?: Array<{ name?: string; state?: string }> }> }
type Title = { titleId?: string; name?: string; displayImage?: string | null; images?: Array<{ url?: string; type?: string }>; achievement?: { currentGamerscore?: number; currentAchievements?: number }; titleHistory?: { lastTimePlayed?: string } }
type TitleHistoryResponse = { titles?: Title[] }
type UserStatsResponse = { groups?: Array<{ statlistscollection?: Array<{ stats?: Array<{ name?: string; value?: string }> }> }> }

const cache = new Map<string, { expiresAt: number; value: XboxSnapshot }>()
const cacheTtl = 15 * 60 * 1000

async function xboxFetch<T>(path: string, token: WebToken, contractVersion = 3) {
  const response = await fetch(`https://${path}`, {
    headers: {
      Authorization: `XBL3.0 x=${token.data.DisplayClaims.xui[0].uhs};${token.data.Token}`,
      'x-xbl-contract-version': String(contractVersion),
      'Accept-Language': 'en-US',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Xbox API ${path.split('.')[0]} returned ${response.status}`)
  return await response.json() as T
}

async function getMinutesPlayed(xuid: string, titleId: string, token: WebToken) {
  try {
    const response = await fetch('https://userstats.xboxlive.com/batch', {
      method: 'POST',
      headers: { Authorization: `XBL3.0 x=${token.data.DisplayClaims.xui[0].uhs};${token.data.Token}`, 'x-xbl-contract-version': '2', 'Accept-Language': 'en-US', 'Content-Type': 'application/json' },
      body: JSON.stringify({ arrangebyfield: 'xuid', xuids: [xuid], groups: [{ name: 'Hero', titleId }], stats: [{ name: 'MinutesPlayed', titleId }] }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return null
    const data = await response.json() as UserStatsResponse
    const stat = data.groups?.flatMap((group) => group.statlistscollection || []).flatMap((collection) => collection.stats || []).find((item) => item.name === 'MinutesPlayed')
    const minutes = stat?.value ? Number(stat.value) : NaN
    return Number.isFinite(minutes) ? minutes : null
  } catch {
    return null
  }
}

function setting(profile: Profile, id: string) {
  return profile.settings?.find((item) => item.id === id)?.value || ''
}

export async function fetchXboxSnapshot(): Promise<XboxSnapshot> {
  const tokenFile = process.env.XBOX_TOKEN_FILE || '.xbox.tokens.json'
  const fetchedAt = new Date().toISOString()
  const store = new TokenStore()
  if (!store.load(tokenFile, true) || !store.getUserToken()) {
    return { configured: false, profile: null, state: 'Unknown', currentGame: null, games: [], fetchedAt, message: 'run npm run auth:xbox to connect Xbox' }
  }

  const cached = cache.get(tokenFile)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  try {
    const msal = new Msal(store)
    const token = await msal.getWebToken() as unknown as WebToken
    const profileResponse = await xboxFetch<ProfileResponse>('profile.xboxlive.com/users/me/profile/settings?settings=GameDisplayName,GameDisplayPicRaw,Gamerscore,Gamertag', token)
    const profile = profileResponse.profileUsers?.[0]
    if (!profile) throw new Error('Xbox profile not found')
    const [presence, titleHistory] = await Promise.all([
      xboxFetch<PresenceResponse>('userpresence.xboxlive.com/users/me?level=all', token).catch(() => ({ state: undefined, devices: [] } as PresenceResponse)),
      xboxFetch<TitleHistoryResponse>(`titlehub.xboxlive.com/users/xuid(${profile.id})/titles/titlehistory/decoration/achievement,image,scid`, token, 2),
    ])
    const games: XboxGame[] = await Promise.all((titleHistory.titles || []).slice(0, 5).map(async (title) => {
      const titleId = title.titleId || title.name || crypto.randomUUID()
      return { titleId, name: title.name || 'Unknown title', playedAt: title.titleHistory?.lastTimePlayed || null, cover: title.displayImage || title.images?.find((image) => image.type === 'BoxArt')?.url || title.images?.[0]?.url || null, gamerscore: title.achievement?.currentGamerscore || 0, achievements: title.achievement?.currentAchievements || 0, minutes: title.titleId ? await getMinutesPlayed(profile.id, title.titleId, token) : null }
    }))
    const currentGame = presence.devices?.flatMap((device) => device.titles || []).find((title) => title.state?.toLowerCase() === 'active')?.name || null
    const value: XboxSnapshot = {
      configured: true,
      profile: { xuid: profile.id, gamertag: setting(profile, 'Gamertag') || setting(profile, 'GameDisplayName'), displayName: setting(profile, 'GameDisplayName') || null, avatar: setting(profile, 'GameDisplayPicRaw') || null, gamerscore: Number(setting(profile, 'Gamerscore')) || 0 },
      state: presence.state || 'Unknown',
      currentGame,
      games,
      fetchedAt,
    }
    cache.set(tokenFile, { expiresAt: Date.now() + cacheTtl, value })
    return value
  } catch (error) {
    return { configured: true, profile: null, state: 'Unknown', currentGame: null, games: [], fetchedAt, message: error instanceof Error ? error.message : 'Xbox API unavailable' }
  }
}
