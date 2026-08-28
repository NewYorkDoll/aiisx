import { useEffect, useState } from 'react'
import { Prompt, PromptInput } from '../components/Prompt'
import { getGames, getSteam, getXbox } from '../lib/api'
import type { GameRecord, SteamSnapshot, XboxSnapshot } from '../../shared/types'

export default function Games() {
  const [games, setGames] = useState<GameRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [steam, setSteam] = useState<SteamSnapshot | null>(null)
  const [xbox, setXbox] = useState<XboxSnapshot | null>(null)
  useEffect(() => { getGames().then(setGames).catch(() => undefined).finally(() => setLoading(false)) }, [])
  useEffect(() => { getSteam().then(setSteam).catch(() => undefined) }, [])
  useEffect(() => { getXbox().then(setXbox).catch(() => undefined) }, [])
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
      {xbox && <section className="xbox-card" aria-label="Xbox activity">
        <div className="steam-card-head"><div><p className="kicker">XBOX / ACTIVITY</p><h2>{xbox.profile?.gamertag || 'xbox account'}</h2></div>{xbox.profile?.avatar && <img className="steam-avatar" src={xbox.profile.avatar} alt="" />}</div>
        {xbox.message ? <p className="dim steam-message">{xbox.message}</p> : <>
          <div className="steam-readout"><span><small>STATUS</small><strong className={xbox.state === 'Online' ? 'is-online' : ''}>{xbox.state.toLowerCase()}</strong></span><span><small>GAMERSCORE</small><strong>{xbox.profile?.gamerscore.toLocaleString() || '0'}</strong></span>{xbox.currentGame && <span><small>PLAYING</small><strong>{xbox.currentGame}</strong></span>}</div>
          <div className="steam-games">{xbox.games.length ? xbox.games.map((game) => <article className="steam-game" key={game.titleId}>{game.cover ? <img src={game.cover} alt="" /> : <div className="game-thumb" /> }<div><h3>{game.name}</h3><p>{game.minutes === null ? 'duration unavailable' : `${(game.minutes / 60).toFixed(1)} hours`} / {game.achievements} achievements / {game.gamerscore}G</p></div></article>) : <p className="dim">no Xbox title history</p>}</div>
        </>}
      </section>}
      <div className="switch-heading"><p className="kicker">SWITCH / ARCHIVE</p></div>
      <div className="game-list">{loading ? <p className="dim">querying save data...</p> : games.length ? games.map((game) => <article className="game-row" key={game.id}>{game.cover ? <img src={game.cover} alt="" /> : <div className="game-thumb">?</div>}<div><h2>{game.title}</h2><p>{(game.minutes / 60).toFixed(1)} hours / {new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(game.playedAt))}</p></div><span>↗</span></article>) : <p className="dim">no switch sync yet — run the TypeScript worker.</p>}</div>
    </Prompt>
    <PromptInput />
  </div>
}
