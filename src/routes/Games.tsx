import { useEffect, useState } from 'react'
import { Prompt, PromptInput } from '../components/Prompt'
import { SwitchConsole } from '../components/SwitchConsole'
import { SteamActivity, XboxActivity } from '../components/PlatformActivity'
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
      <div className="module-intro"><p className="kicker">ARCHIVE / SWITCH + STEAM + XBOX</p><h1>No Game<br /><em>No Life.</em></h1><p className="lede">最近打开的游戏，以及每次存档之后还想再玩一会儿的理由。</p></div>
      <SwitchConsole games={games} loading={loading} />
      {steam && <SteamActivity data={steam} />}
      {xbox && <XboxActivity data={xbox} />}
    </Prompt>
    <PromptInput />
  </div>
}
