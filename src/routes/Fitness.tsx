import { useEffect, useState } from 'react'
import { Prompt, PromptInput } from '../components/Prompt'
import { getFitness } from '../lib/api'
import type { FitnessSnapshot } from '../../shared/types'

const empty: FitnessSnapshot = { weight: null, weightUnit: 'kg', sessions: 0, minutes: 0, planName: null, todayName: null, fetchedAt: '', recentSets: [] }

export default function Fitness() {
  const [data, setData] = useState<FitnessSnapshot>(empty)
  const [ready, setReady] = useState(false)
  useEffect(() => { getFitness().then((snapshot) => { setData(snapshot); setReady(true) }).catch(() => undefined) }, [])
  const recentSets = (data.recentSets || []).filter((set) => set.actionName).slice(0, 10)
  return (
    <div className="route-stack">
      <Prompt command="training --status">
        <div className="module-intro">
          <p className="kicker">KEEPSTRONG / READ ONLY</p>
          <h1>Strong body,<br /><em>clear mind.</em></h1>
          <p className="lede">练练健身里的训练记录会在服务端聚合，只把适合公开展示的摘要带到这里。</p>
        </div>
        <div className="fitness-readout">
          <div className="fitness-big"><span className="readout-label">sessions / 30d</span><strong>{data.sessions.toString().padStart(2, '0')}</strong></div>
          <div><span className="readout-label">time under tension</span><strong>{data.minutes}<small> min</small></strong></div>
          <div><span className="readout-label">recent sets</span><strong>{recentSets.length}</strong></div>
        </div>
        <div className="training-plan">
          <span className="readout-label">active plan</span>
          <strong>{data.planName || (ready ? 'No active plan' : 'waiting for api')}</strong>
          <span className="plan-today">today / {data.todayName || '—'}</span>
        </div>
      </Prompt>
      <Prompt command="training --recent --limit=10">
        <div className="recent-sessions">
          <span className="readout-label">last 10 completed sets</span>
          {recentSets.length ? recentSets.map((set, index) => (
            <article className="recent-set" key={set.id}>
              <span className="recent-set-index">#{String(index + 1).padStart(2, '0')}</span>
              <div className="recent-set-name">
                <strong>{set.actionName}</strong>
                <span>{set.planName} / 第 {set.setNumber} 组</span>
              </div>
              <b>{set.reps || '—'}<small> 次</small></b>
              <time>{set.date}</time>
            </article>
          )) : <p className="dim">no workout history</p>}
        </div>
      </Prompt>
      <PromptInput />
    </div>
  )
}
