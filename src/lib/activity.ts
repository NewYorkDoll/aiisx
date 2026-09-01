import type { BlogPost, FitnessActionSummary, FitnessSnapshot, GameRecord, SteamSnapshot, XboxSnapshot } from '../../shared/types'

export type ActivitySource = 'journal' | 'switch' | 'steam' | 'xbox' | 'training'

export type ActivityItem = {
  id: string
  source: ActivitySource
  title: string
  detail: string
  occurredAt: string
  slug?: string
}

const activityDayFormatter = new Intl.DateTimeFormat('en', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
})

const sourcePriority: Record<ActivitySource, number> = {
  journal: 3,
  training: 2,
  steam: 1,
  switch: 1,
  xbox: 1,
}

function activityDay(value: string) {
  const parts = Object.fromEntries(activityDayFormatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

function compareActivity(left: ActivityItem, right: ActivityItem) {
  const day = activityDay(right.occurredAt).localeCompare(activityDay(left.occurredAt))
  if (day) return day
  const priority = sourcePriority[right.source] - sourcePriority[left.source]
  if (priority) return priority
  const timestamp = new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
  return timestamp || left.id.localeCompare(right.id)
}

function trainingDate(value: string) {
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compact) return new Date(`${compact[1]}-${compact[2]}-${compact[3]}T12:00:00+08:00`).toISOString()
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? new Date(0).toISOString() : timestamp.toISOString()
}

function groupTraining(actions: FitnessActionSummary[]) {
  const sessions = new Map<string, { date: string; plan: string; actions: number; sets: number }>()
  for (const action of actions) {
    const key = `${action.date}:${action.planName}`
    const session = sessions.get(key) || { date: action.date, plan: action.planName, actions: 0, sets: 0 }
    session.actions += 1
    session.sets += action.sets
    sessions.set(key, session)
  }
  return [...sessions.values()]
}

function hours(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  return `${(minutes / 60).toFixed(minutes >= 600 ? 0 : 1)} h`
}

export function buildActivityFeed(input: {
  posts: BlogPost[]
  switchGames: GameRecord[]
  steam: SteamSnapshot | null
  xbox: XboxSnapshot | null
  fitness: FitnessSnapshot | null
}) {
  const items: ActivityItem[] = []

  for (const post of input.posts.slice(0, 6)) {
    items.push({ id: `post:${post.id}`, source: 'journal', title: post.title, detail: post.excerpt, occurredAt: post.publishedAt || post.updatedAt, slug: post.slug })
  }
  for (const game of input.switchGames.slice(0, 4)) {
    items.push({ id: `switch:${game.id}`, source: 'switch', title: game.title, detail: `played / ${hours(game.minutes)}`, occurredAt: game.playedAt })
  }
  for (const game of input.xbox?.games.slice(0, 3) || []) {
    if (!game.playedAt) continue
    const playtime = game.minutes === null ? 'time unavailable' : hours(game.minutes)
    items.push({ id: `xbox:${game.titleId}`, source: 'xbox', title: game.name, detail: `${playtime} / ${game.achievements} achievements`, occurredAt: game.playedAt })
  }
  const steamGame = input.steam?.games
    .filter((game) => game.minutes > 0 && game.playedAt)
    .sort((left, right) => new Date(right.playedAt!).getTime() - new Date(left.playedAt!).getTime())[0]
  if (steamGame?.playedAt) {
    items.push({ id: `steam:${steamGame.appId}`, source: 'steam', title: steamGame.name, detail: `recent 2 weeks / ${hours(steamGame.minutes)}`, occurredAt: steamGame.playedAt })
  }
  for (const session of groupTraining(input.fitness?.recentActions || []).slice(0, 3)) {
    items.push({ id: `training:${session.date}:${session.plan}`, source: 'training', title: session.plan, detail: `${session.actions} actions / ${session.sets} sets`, occurredAt: trainingDate(session.date) })
  }

  return items
    .filter((item) => !Number.isNaN(new Date(item.occurredAt).getTime()))
    .sort(compareActivity)
    .slice(0, 10)
}
