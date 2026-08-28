import { useEffect, useState } from 'react'
import { Prompt, PromptInput } from '../components/Prompt'
import { getFitness } from '../lib/api'
import type { FitnessSnapshot } from '../../shared/types'

const empty: FitnessSnapshot = { weight: null, weightUnit: 'kg', sessions: 0, minutes: 0, planName: null, todayName: null, fetchedAt: '', recentSets: [] }

export default function Fitness() {
  const [data, setData] = useState<FitnessSnapshot>(empty)
  const [ready, setReady] = useState(false)
  useEffect(() => { getFitness().then((snapshot) => { setData(snapshot); setReady(true) }).catch(() => undefined) }, [])
  const recentSets = (data.recentSets || []).map((session) => ({
    ...session,
    actionCount: session.actionCount || 0,
    actionNames: Array.isArray(session.actionNames) ? session.actionNames : [],
  }))
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
          <div><span className="readout-label">recent sets</span><strong>{recentSets.reduce((total, session) => total + session.sets, 0)}</strong></div>
        </div>
        <div className="training-plan">
          <span className="readout-label">active plan</span>
          <strong>{data.planName || (ready ? 'No active plan' : 'waiting for api')}</strong>
          <span className="plan-today">today / {data.todayName || '—'}</span>
        </div>
      </Prompt>
      <Prompt command="training --history">
        <div className="recent-sessions">
          <span className="readout-label">last 10 workouts / actions</span>
          {recentSets.length ? recentSets.map((session) => (
            <article className="recent-session" key={session.id}>
              <div className="recent-session-head">
                <span>{session.date}</span>
                <em>{session.name}</em>
                <strong>{session.actionCount} actions / {session.sets} sets</strong>
              </div>
              {session.actionNames.length ? (
                <ol className="recent-actions">
                  {session.actionNames.map((action, index) => <li key={`${session.id}-${index}`}>{action}</li>)}
                </ol>
              ) : <p className="recent-actions-empty">暂无动作明细</p>}
            </article>
          )) : <p className="dim">no workout history</p>}
        </div>
      </Prompt>
      <PromptInput />
    </div>
  )
}
