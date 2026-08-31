import 'dotenv/config'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { postInputSchema } from '../shared/types'
import { listGames } from './db'
import { getStoredFitnessSnapshot, getStoredSteamSnapshot, getStoredXboxSnapshot } from './platform-store'
import { repository } from './repository'

const app = new Hono()
app.use('/api/*', cors())

const sessionCookie = 'aiisx_admin_session'
const sessionDays = 7

function sessionValue() {
  const now = Math.floor(Date.now() / 1000)
  const expires = now + sessionDays * 24 * 60 * 60
  const payload = `${now}.${expires}`
  const signature = createHmac('sha256', process.env.ADMIN_TOKEN || '').update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function secureEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

function isAdmin(c: Context) {
  const secret = process.env.ADMIN_TOKEN
  const value = getCookie(c, sessionCookie)
  if (!secret || !value) return false
  const [issuedAt, expiresAt, signature] = value.split('.')
  const payload = `${issuedAt}.${expiresAt}`
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  if (!issuedAt || !expiresAt || !signature || Number.isNaN(Number(expiresAt)) || Number(expiresAt) < Math.floor(Date.now() / 1000)) return false
  return secureEqual(signature, expected)
}

function isCronAuthorized(c: Context) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && secureEqual(c.req.header('authorization') || '', `Bearer ${secret}`)
}

app.post('/api/auth/login', async (c) => {
  const secret = process.env.ADMIN_TOKEN
  if (!secret) return c.json({ message: 'Admin login is not configured. Set ADMIN_TOKEN first.' }, 503)
  const body = await c.req.json().catch(() => ({})) as { token?: string }
  if (!secureEqual(body.token || '', secret)) return c.json({ message: 'Invalid admin token' }, 401)
  setCookie(c, sessionCookie, sessionValue(), { httpOnly: true, sameSite: 'Lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: sessionDays * 24 * 60 * 60 })
  return c.json({ authenticated: true })
})

app.get('/api/auth/me', (c) => c.json({ authenticated: isAdmin(c), configured: Boolean(process.env.ADMIN_TOKEN) }))
app.post('/api/auth/logout', (c) => { deleteCookie(c, sessionCookie, { path: '/' }); return c.json({ authenticated: false }) })
app.get('/api/health', (c) => c.json({ ok: true, service: 'aiisx-api' }))
app.get('/api/games', async (c) => c.json({ items: await listGames().catch(() => []) }))
app.get('/api/fitness', async (c) => c.json(await getStoredFitnessSnapshot().catch(() => null) || { weight: null, weightUnit: 'kg', sessions: 0, minutes: 0, planName: null, todayName: null, fetchedAt: new Date().toISOString(), recentActions: [], message: 'no fitness sync yet - run npm run sync:platforms' }))
app.get('/api/steam', async (c) => c.json(await getStoredSteamSnapshot().catch(() => null) || { configured: Boolean(process.env.STEAM_API_KEY && process.env.STEAM_ID), profile: null, playTimeMinutes: 0, games: [], fetchedAt: new Date().toISOString(), message: 'no Steam sync yet - run npm run sync:platforms' }))
app.get('/api/xbox', async (c) => c.json(await getStoredXboxSnapshot().catch(() => null) || { configured: false, profile: null, state: 'Unknown', currentGame: null, games: [], fetchedAt: new Date().toISOString(), message: 'no Xbox sync yet - run npm run sync:platforms' }))

app.get('/api/cron/:slot', async (c) => {
  if (!process.env.CRON_SECRET) return c.json({ message: 'Cron is not configured' }, 503)
  if (!isCronAuthorized(c)) return c.json({ message: 'Unauthorized' }, 401)
  const slot = c.req.param('slot')
  if (slot !== 'noon' && slot !== 'evening') return c.json({ message: 'Cron slot not found' }, 404)
  const { syncPlatforms } = await import('./sync-platforms')
  const result = await syncPlatforms()
  const body = { slot, completedAt: new Date().toISOString(), ...result }
  return result.failed ? c.json(body, 502) : c.json(body)
})

app.get('/api/posts', async (c) => {
  const rawStatus = c.req.query('status') || 'published'
  const status = rawStatus === 'draft' || rawStatus === 'all' ? rawStatus : 'published'
  if (status !== 'published' && !isAdmin(c)) return c.json({ message: 'Unauthorized' }, 401)
  return c.json({ items: await repository.list(status) })
})

app.get('/api/posts/:slug', async (c) => {
  const post = await repository.get(c.req.param('slug'))
  if (post?.status === 'draft' && !isAdmin(c)) return c.json({ message: 'Unauthorized' }, 401)
  return post ? c.json(post) : c.json({ message: 'Post not found' }, 404)
})

app.post('/api/posts', async (c) => {
  if (!isAdmin(c)) return c.json({ message: 'Unauthorized' }, 401)
  const parsed = postInputSchema.safeParse(await c.req.json())
  if (!parsed.success) return c.json({ message: 'Invalid post', issues: parsed.error.flatten() }, 400)
  return c.json(await repository.create(parsed.data), 201)
})

app.patch('/api/posts/:slug', async (c) => {
  if (!isAdmin(c)) return c.json({ message: 'Unauthorized' }, 401)
  const parsed = postInputSchema.safeParse(await c.req.json())
  if (!parsed.success) return c.json({ message: 'Invalid post', issues: parsed.error.flatten() }, 400)
  const post = await repository.update(c.req.param('slug'), parsed.data)
  return post ? c.json(post) : c.json({ message: 'Post not found' }, 404)
})

app.delete('/api/posts/:slug', async (c) => {
  if (!isAdmin(c)) return c.json({ message: 'Unauthorized' }, 401)
  const removed = await repository.remove(c.req.param('slug'))
  return removed ? c.json({ deleted: true }) : c.json({ message: 'Post not found' }, 404)
})

export default app
