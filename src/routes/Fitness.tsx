import { useEffect, useState } from 'react'
import { Prompt, PromptInput } from '../components/Prompt'
import { getFitness } from '../lib/api'
import type { FitnessSnapshot } from '../../shared/types'

const empty: FitnessSnapshot = { weight: null, weightUnit: 'kg', sessions: 0, minutes: 0, planName: null, todayName: null, fetchedAt: '' }

export default function Fitness() {
  const [data, setData] = useState<FitnessSnapshot>(empty)
  const [ready, setReady] = useState(false)
  useEffect(() => { getFitness().then((snapshot) => { setData(snapshot); setReady(true) }).catch(() => undefined) }, [])
  return <div className="route-stack"><Prompt command="training --status"><div className="module-intro"><p className="kicker">KEEPSTRONG / READ ONLY</p><h1>Strong body,<br /><em>clear mind.</em></h1><p className="lede">练练健身里的训练记录会在服务端聚合，只把适合公开展示的摘要带到这里。</p></div><div className="fitness-readout"><div className="fitness-big"><span className="readout-label">sessions / 30d</span><strong>{data.sessions.toString().padStart(2, '0')}</strong></div><div><span className="readout-label">time under tension</span><strong>{data.minutes}<small> min</small></strong></div><div><span className="readout-label">body weight</span><strong>{data.weight ? `${data.weight}` : '--'}<small>{data.weight ? ` ${data.weightUnit}` : ''}</small></strong></div></div><div className="training-plan"><span className="readout-label">active plan</span><strong>{data.planName || (ready ? 'No active plan' : 'waiting for api')}</strong><span className="plan-today">today / {data.todayName || '—'}</span></div></Prompt><Prompt command="training --privacy"><p className="privacy-note">No workout writes happen here. This module only reads your private KeepStrong data through the server.</p></Prompt><PromptInput /></div>
}
