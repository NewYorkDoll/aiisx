import { lazy, Suspense } from 'react'
import { Skeleton } from '../components/DataSkeleton'
import { Prompt, PromptInput } from '../components/Prompt'
import { getFitness } from '../lib/api'
import { usePageMeta } from '../lib/meta'
import { useResource } from '../lib/resource'
import type { FitnessSnapshot } from '../../shared/types'

const empty: FitnessSnapshot = { weight: null, weightUnit: 'kg', sessions: 0, minutes: 0, planName: null, todayName: null, fetchedAt: '', recentActions: [] }
const MuscleFigure = lazy(() => import('../components/MuscleFigure').then((module) => ({ default: module.MuscleFigure })))

export default function Fitness() {
  usePageMeta({ title: 'training', description: '最近完成的训练动作、训练计划与肌群视图。', path: '/fitness' })
  const resource = useResource('fitness:snapshot', getFitness)
  const data = resource.data || empty
  const pending = resource.loading && !resource.data
  const recentActions = (data.recentActions || []).filter((action) => action.actionName).slice(0, 10)
  return (
    <div className="route-stack data-view" aria-busy={pending || resource.refreshing}>
      <Prompt command="training --status">
        <div className="fitness-overview">
          <div className="fitness-copy">
            <div className="module-intro">
              <p className="kicker">KEEPSTRONG / READ ONLY</p>
              <h1>Strong body,<br /><em>clear mind.</em></h1>
              <p className="lede">练练健身里的训练记录会在服务端聚合，只把适合公开展示的摘要带到这里。</p>
            </div>
            <div className="fitness-readout">
              <div className="fitness-big"><span className="readout-label">sessions / 30d</span><strong>{pending ? <Skeleton width="46px" height="26px" /> : data.sessions.toString().padStart(2, '0')}</strong></div>
              <div><span className="readout-label">time under tension</span><strong>{pending ? <Skeleton width="78px" height="26px" /> : <>{data.minutes}<small> min</small></>}</strong></div>
              <div><span className="readout-label">recent actions</span><strong>{pending ? <Skeleton width="32px" height="26px" /> : recentActions.length}</strong></div>
            </div>
            <div className="training-plan">
              <span className="readout-label">active plan</span>
              <strong>{pending ? <Skeleton width="180px" height="17px" /> : data.planName || 'No active plan'}</strong>
              <span className="plan-today">today / {pending ? <Skeleton width="110px" /> : data.todayName || '—'}</span>
            </div>
          </div>
          {pending ? <div className="muscle-loading" aria-label="正在载入肌群数据" aria-busy="true"><span /></div> : <Suspense fallback={<div className="muscle-loading" aria-hidden="true"><span /></div>}><MuscleFigure actions={data.recentActions || []} /></Suspense>}
        </div>
      </Prompt>
      <Prompt command="training --recent --limit=10">
        <div className="recent-sessions">
          <span className="readout-label">last 10 completed actions</span>
          {pending ? Array.from({ length: 6 }, (_, index) => <article className="recent-set skeleton-row" key={index}><Skeleton width="26px" /><div><Skeleton width="52%" height="14px" /><Skeleton width="74%" /></div><Skeleton width="42px" height="18px" /><Skeleton width="70px" /></article>) : recentActions.length ? recentActions.map((action, index) => (
            <article className="recent-set" key={action.id}>
              <span className="recent-set-index">#{String(index + 1).padStart(2, '0')}</span>
              <div className="recent-set-name">
                <strong>{action.actionName}</strong>
                <span>{action.planName} / 完成 {action.sets} 组</span>
              </div>
              <b>{action.sets}<small> 组</small></b>
              <time>{action.date}</time>
            </article>
          )) : <p className="dim">no workout history</p>}
        </div>
      </Prompt>
      <PromptInput />
    </div>
  )
}
