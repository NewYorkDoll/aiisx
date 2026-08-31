import type { FitnessActionSummary, FitnessSnapshot } from '../shared/types.js'

const baseUrl = process.env.KEEPSTRONG_BASE_URL || 'https://lianlian.gzyunke.cn'
const skillVersion = '1.24.0'

type TrainingGroup = { _id?: string; reps?: string | number }
type RecordItem = { id?: string; status?: string; durationSeconds?: number; name?: string; dayStr?: string; createdAt?: string; actions?: Array<{ actionId?: string; name?: string; groups?: TrainingGroup[] }> }
type Plan = { name?: string; today?: { schedule?: { name?: string } } }

async function getJson<T>(path: string, params?: Record<string, string | number>) {
  const apiKey = process.env.KEEPSTRONG_API_KEY
  if (!apiKey) return null
  const url = new URL(path, baseUrl)
  Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, String(value)))
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}`, 'X-KeepStrong-Skill-Version': skillVersion, 'X-KeepStrong-Agent-Name': 'Codex', 'X-Timezone-Offset': process.env.KEEPSTRONG_TIMEZONE_OFFSET || '480' } })
  if (!response.ok) throw new Error(`KeepStrong request failed: ${response.status}`)
  return await response.json() as T
}

function dayString(date: Date) { return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}` }

export async function fetchFitnessSnapshot(): Promise<FitnessSnapshot> {
  const apiKey = process.env.KEEPSTRONG_API_KEY
  if (!apiKey) return { weight: null, weightUnit: 'kg', sessions: 0, minutes: 0, planName: null, todayName: null, fetchedAt: new Date().toISOString(), recentActions: [] }
  const start = new Date(); start.setDate(start.getDate() - 30)
  const [recordsResponse, plansResponse] = await Promise.all([
    getJson<{ list?: RecordItem[] }>('/api/v1/ai/training/records', { startDate: dayString(start), endDate: dayString(new Date()), page: 1, pageSize: 50 }),
    getJson<{ list?: Plan[] }>('/api/v1/ai/training/running-plans'),
  ])
  const records = recordsResponse?.list || []
  const completed = records.filter((record) => record.status === 'completed')
  const recentActions: FitnessActionSummary[] = completed
    .slice()
    .sort((a, b) => (b.dayStr || b.createdAt || '').localeCompare(a.dayStr || a.createdAt || ''))
    .flatMap((record) => (record.actions || []).map((action, actionIndex) => ({
        id: `${record.id || record.dayStr || 'session'}-${action.actionId || actionIndex}`,
        planName: record.name || 'workout',
        actionName: action.name || 'exercise',
        date: record.dayStr || record.createdAt || '',
        sets: action.groups?.length || 0,
        sequence: actionIndex,
      })))
    .slice(0, 10)
  return { weight: null, weightUnit: 'kg', sessions: completed.length, minutes: Math.round(completed.reduce((sum, record) => sum + (record.durationSeconds || 0), 0) / 60), planName: plansResponse?.list?.[0]?.name || null, todayName: plansResponse?.list?.[0]?.today?.schedule?.name || null, fetchedAt: new Date().toISOString(), recentActions }
}
