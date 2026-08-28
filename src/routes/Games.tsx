import { useEffect, useState } from 'react'
import { Prompt, PromptInput } from '../components/Prompt'
import { getGames, getSteam } from '../lib/api'
import type { GameRecord, SteamSnapshot } from '../../shared/types'

export default function Games() {
  const [games, setGames] = useState<GameRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [steam, setSteam] = useState<SteamSnapshot | null>(null)
  useEffect(() => { getGames().then(setGames).catch(() => undefined).finally(() => setLoading(false)) }, [])
  useEffect(() => { getSteam().then(setSteam).catch(() => undefined) }, [])
  return <div className="route-stack">
    <Prompt command="games --recent">
      <div className="module-intro"><p className="kicker">ARCHIVE / STEAM + SWITCH</p><h1>No Game<br /><em>No Life.</em></h1><p className="lede">最近打开的游戏，以及每次存档之后还想再玩一会儿的理由。</p></div>
      {steam && <section className="steam-card" aria-label="Steam activity">
        <div className="steam-card-head"><div><p className="kicker">STEAM / ACTIVITY</p><h2>{steam.profile?.name || 'steam account'}</h2></div>{steam.profile?.avatar && <img className="steam-avatar" src={steam.profile.avatar} alt="" />}</div>
        {steam.message ? <p className="dim steam-message">{steam.message}</p> : <>
          <div className="steam-readout"><span><small>STATUS</small><strong className={steam.profile?.state === 1 ? 'is-online' : ''}>{steam.profile?.state === 1 ? 'online' : 'offline'}</strong></span><span><small>2 WEEKS</small><strong>{(steam.playTimeMinutes / 60).toFixed(1)}h</strong></span></div>
          <div className="steam-games">{steam.games.length ? steam.games.map((game) => <article className="steam-game" key={game.appId}><img src={game.cover} alt="" /><div><h3>{game.name}</h3><p>{(game.minutes / 60).toFixed(1)} hours</p></div></article>) : <p className="dim">no recent Steam games</p>}</div>
        </>}
      </section>}
      <div className="switch-heading"><p className="kicker">SWITCH / ARCHIVE</p></div>
      <div className="game-list">{loading ? <p className="dim">querying save data...</p> : games.length ? games.map((game) => <article className="game-row" key={game.id}>{game.cover ? <img src={game.cover} alt="" /> : <div className="game-thumb">?</div>}<div><h2>{game.title}</h2><p>{(game.minutes / 60).toFixed(1)} hours / {new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(game.playedAt))}</p></div><span>↗</span></article>) : <p className="dim">no switch sync yet — run the TypeScript worker.</p>}</div>
    </Prompt>
    <PromptInput />
  </div>
}
