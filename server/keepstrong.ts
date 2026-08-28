import type { FitnessSnapshot } from '../shared/types'

const baseUrl = process.env.KEEPSTRONG_BASE_URL || 'https://lianlian.gzyunke.cn'
const apiKey = process.env.KEEPSTRONG_API_KEY
const skillVersion = '1.24.0'

type Profile = { weight: number | null; weightUnit: string }
type RecordItem = { status?: string; durationSeconds?: number }
type Plan = { name?: string; today?: { schedule?: { name?: string } } }

async function getJson<T>(path: string, params?: Record<string, string | number>) {
  if (!apiKey) return null
  const url = new URL(path, baseUrl)
  Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, String(value)))
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}`, 'X-KeepStrong-Skill-Version': skillVersion, 'X-KeepStrong-Agent-Name': 'Codex', 'X-Timezone-Offset': process.env.KEEPSTRONG_TIMEZONE_OFFSET || '480' } })
  if (!response.ok) throw new Error(`KeepStrong request failed: ${response.status}`)
  return await response.json() as T
}

function dayString(date: Date) { return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}` }

export async function getFitnessSnapshot(): Promise<FitnessSnapshot> {
  if (!apiKey) return { weight: null, weightUnit: 'kg', sessions: 0, minutes: 0, planName: null, todayName: null, fetchedAt: new Date().toISOString() }
  const start = new Date(); start.setDate(start.getDate() - 30)
  const [profile, recordsResponse, plansResponse] = await Promise.all([
    getJson<Profile>('/api/v1/ai/body/profile'),
    getJson<{ list?: RecordItem[] }>('/api/v1/ai/training/records', { startDate: dayString(start), endDate: dayString(new Date()), page: 1, pageSize: 50 }),
    getJson<{ list?: Plan[] }>('/api/v1/ai/training/running-plans'),
  ])
  const records = recordsResponse?.list || []
  const completed = records.filter((record) => record.status === 'completed')
  return { weight: profile?.weight || null, weightUnit: profile?.weightUnit || 'kg', sessions: completed.length, minutes: Math.round(completed.reduce((sum, record) => sum + (record.durationSeconds || 0), 0) / 60), planName: plansResponse?.list?.[0]?.name || null, todayName: plansResponse?.list?.[0]?.today?.schedule?.name || null, fetchedAt: new Date().toISOString() }
}
