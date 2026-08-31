import { Skeleton } from '../components/DataSkeleton'
import { Prompt, PromptInput } from '../components/Prompt'
import { SwitchConsole } from '../components/SwitchConsole'
import { SteamActivity, XboxActivity } from '../components/PlatformActivity'
import { getGames, getSteam, getXbox } from '../lib/api'
import { usePageMeta } from '../lib/meta'
import { useResource } from '../lib/resource'
import type { GameRecord, SteamSnapshot, XboxSnapshot } from '../../shared/types'

type GamesSnapshot = { games: GameRecord[]; steam: SteamSnapshot | null; xbox: XboxSnapshot | null }

async function loadGamesSnapshot(): Promise<GamesSnapshot> {
  const [games, steam, xbox] = await Promise.all([
    getGames(),
    getSteam().catch(() => null),
    getXbox().catch(() => null),
  ])
  return { games, steam, xbox }
}

function PlatformSkeleton({ label }: { label: string }) {
  return <section className="platform-skeleton" aria-label={`正在载入 ${label}`} aria-busy="true">
    <div><span><Skeleton width="120px" /><Skeleton width="190px" height="22px" /></span><Skeleton width="130px" height="30px" /></div>
    <Skeleton className="platform-skeleton-device" width="100%" height="clamp(260px, 48vw, 520px)" />
  </section>
}

export default function Games() {
  usePageMeta({ title: 'game-are-life', description: 'Switch、Steam 与 Xbox 的最近游戏记录。', path: '/game-are-life' })
  const { data, loading, refreshing } = useResource('games:platforms', loadGamesSnapshot)
  const pending = loading && !data
  const games = data?.games || []
  return <div className="route-stack data-view" aria-busy={pending || refreshing}>
    <Prompt command="games --recent">
      <div className="module-intro"><p className="kicker">ARCHIVE / SWITCH + STEAM + XBOX</p><h1>No Game<br /><em>No Life.</em></h1><p className="lede">最近打开的游戏，以及每次存档之后还想再玩一会儿的理由。</p></div>
      <SwitchConsole games={games} loading={pending} />
      {pending ? <><PlatformSkeleton label="Steam" /><PlatformSkeleton label="Xbox" /></> : <>{data?.steam && <div className="data-reveal"><SteamActivity data={data.steam} /></div>}{data?.xbox && <div className="data-reveal"><XboxActivity data={data.xbox} /></div>}</>}
    </Prompt>
    <PromptInput />
  </div>
}
