import { z } from 'zod'

export const postInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(30_000),
  mood: z.string().trim().max(32).default('curious'),
  status: z.enum(['draft', 'published']).default('draft'),
})

export type PostInput = z.infer<typeof postInputSchema>

export type BlogPost = PostInput & {
  id: string
  slug: string
  excerpt: string
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export type GameRecord = {
  id: string
  title: string
  cover: string | null
  playedAt: string
  minutes: number
}

export type SteamGame = {
  appId: number
  name: string
  minutes: number
  cover: string
}

export type SteamSnapshot = {
  configured: boolean
  profile: {
    name: string
    avatar: string
    state: number
    profileUrl: string
  } | null
  playTimeMinutes: number
  games: SteamGame[]
  fetchedAt: string
  message?: string
}

export type XboxGame = {
  titleId: string
  name: string
  playedAt: string | null
  cover: string | null
  gamerscore: number
  achievements: number
  minutes: number | null
}

export type XboxSnapshot = {
  configured: boolean
  profile: {
    xuid: string
    gamertag: string
    displayName: string | null
    avatar: string | null
    gamerscore: number
  } | null
  state: 'Online' | 'Offline' | 'Unknown'
  currentGame: string | null
  games: XboxGame[]
  fetchedAt: string
  message?: string
}

export type FitnessSnapshot = {
  weight: number | null
  weightUnit: string
  sessions: number
  minutes: number
  planName: string | null
  todayName: string | null
  fetchedAt: string
  recentActions: FitnessActionSummary[]
}

export type FitnessActionSummary = {
  id: string
  planName: string
  actionName: string
  date: string
  sets: number
  sequence: number
}

export type SyncRunItem = {
  id: string
  platform: string
  status: 'running' | 'success' | 'failed' | 'skipped'
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  message: string | null
}

export type SyncRun = {
  id: string
  trigger: 'manual' | 'cron' | 'schedule'
  slot: string | null
  status: 'running' | 'success' | 'partial' | 'failed'
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  succeeded: number
  failed: number
  items: SyncRunItem[]
}
