import type { SteamGame, XboxGame } from './types.js'

export function mergePcGames(steam: SteamGame[], pc: XboxGame[]) {
  const pcPlayedAt = new Map(pc.map((game) => [game.name.trim().normalize('NFKC').toLowerCase(), game.playedAt]))
  const titles = new Set(steam.map((game) => game.name.trim().normalize('NFKC').toLowerCase()))
  return [
    ...steam.map((game) => {
      const recent = pcPlayedAt.get(game.name.trim().normalize('NFKC').toLowerCase())
      const playedAt = Date.parse(recent || '') > Date.parse(game.playedAt || '1970-01-01') ? recent! : game.playedAt
      return { id: `steam:${game.appId}`, title: game.name, cover: game.cover, playedAt, minutes: game.minutes as number | null, source: 'Steam' as const, timeScope: 'period' as const }
    }),
    // ponytail: only identical names are merged; use provider IDs if cross-store title variants need matching.
    ...pc.filter((game) => !titles.has(game.name.trim().normalize('NFKC').toLowerCase())).map((game) => ({ id: `pc:${game.titleId}`, title: game.name, cover: game.cover, playedAt: game.playedAt, minutes: game.minutes, source: 'PC' as const, timeScope: 'lifetime' as const })),
  ].sort((left, right) => Date.parse(right.playedAt || '1970-01-01') - Date.parse(left.playedAt || '1970-01-01'))
}
