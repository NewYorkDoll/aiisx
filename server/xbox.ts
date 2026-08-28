import { Msal, TokenStore } from 'xal-node'
import type { XboxGame, XboxSnapshot } from '../shared/types'

type WebToken = { data: { Token: string; DisplayClaims: { xui: Array<{ uhs: string }> } } }
type Profile = { id: string; settings?: Array<{ id: string; value: string }> }
type ProfileResponse = { profileUsers?: Profile[] }
type PresenceResponse = { state?: 'Online' | 'Offline'; devices?: Array<{ titles?: Array<{ name?: string; state?: string }> }> }
type Title = { titleId?: string; name?: string; displayImage?: string | null; images?: Array<{ url?: string; type?: string }>; achievement?: { currentGamerscore?: number; currentAchievements?: number }; titleHistory?: { lastTimePlayed?: string } }
type TitleHistoryResponse = { titles?: Title[] }

const cache = new Map<string, { expiresAt: number; value: XboxSnapshot }>()
const cacheTtl = 15 * 60 * 1000

async function xboxFetch<T>(path: string, token: WebToken) {
  const response = await fetch(`https://${path}`, {
    headers: {
      Authorization: `XBL3.0 x=${token.data.DisplayClaims.xui[0].uhs};${token.data.Token}`,
      'x-xbl-contract-version': '3',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Xbox API returned ${response.status}`)
  return await response.json() as T
}

function setting(profile: Profile, id: string) {
  return profile.settings?.find((item) => item.id === id)?.value || ''
}

export async function getXboxSnapshot(): Promise<XboxSnapshot> {
  const tokenFile = process.env.XBOX_TOKEN_FILE || '.xbox.tokens.json'
  const fetchedAt = new Date().toISOString()
  const store = new TokenStore()
  if (!store.load(tokenFile, true) || !store.hasValidAuthTokens()) {
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
      xboxFetch<TitleHistoryResponse>(`titlehub.xboxlive.com/users/xuid(${profile.id})/titles/titlehistory/decoration/achievement,image,scid`, token),
    ])
    const games: XboxGame[] = (titleHistory.titles || []).slice(0, 5).map((title) => ({
      titleId: title.titleId || title.name || crypto.randomUUID(),
      name: title.name || 'Unknown title',
      playedAt: title.titleHistory?.lastTimePlayed || null,
      cover: title.displayImage || title.images?.find((image) => image.type === 'BoxArt')?.url || title.images?.[0]?.url || null,
      gamerscore: title.achievement?.currentGamerscore || 0,
      achievements: title.achievement?.currentAchievements || 0,
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
