import { useEffect, useState } from 'react'
import { Prompt, PromptInput } from '../components/Prompt'
import { getGames } from '../lib/api'
import type { GameRecord } from '../../shared/types'

export default function Games() {
  const [games, setGames] = useState<GameRecord[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { getGames().then(setGames).catch(() => undefined).finally(() => setLoading(false)) }, [])
  return <div className="route-stack"><Prompt command="games --recent"><div className="module-intro"><p className="kicker">ARCHIVE / SWITCH</p><h1>No Game<br /><em>No Life.</em></h1><p className="lede">最近打开的游戏，以及每次存档之后还想再玩一会儿的理由。</p></div><div className="game-list">{loading ? <p className="dim">querying save data...</p> : games.length ? games.map((game) => <article className="game-row" key={game.id}>{game.cover ? <img src={game.cover} alt="" /> : <div className="game-thumb">?</div>}<div><h2>{game.title}</h2><p>{(game.minutes / 60).toFixed(1)} hours / {new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(game.playedAt))}</p></div><span>↗</span></article>) : <p className="dim">no switch sync yet — run the TypeScript worker.</p>}</div></Prompt><PromptInput /></div>
}
