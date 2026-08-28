import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { postInputSchema } from '../shared/types'
import { repository } from './repository'
import { listGames } from './db'
import { getStoredFitnessSnapshot, getStoredSteamSnapshot, getStoredXboxSnapshot } from './platform-store'

const app = new Hono()
app.use('/api/*', cors())
app.get('/api/health', (c) => c.json({ ok: true, service: 'aiisx-api' }))
app.get('/api/games', async (c) => c.json({ items: await listGames().catch(() => []) }))
app.get('/api/fitness', async (c) => c.json(await getStoredFitnessSnapshot().catch(() => null) || { weight: null, weightUnit: 'kg', sessions: 0, minutes: 0, planName: null, todayName: null, fetchedAt: new Date().toISOString(), message: 'no fitness sync yet — run npm run sync:platforms' }))
app.get('/api/steam', async (c) => c.json(await getStoredSteamSnapshot().catch(() => null) || { configured: Boolean(process.env.STEAM_API_KEY && process.env.STEAM_ID), profile: null, playTimeMinutes: 0, games: [], fetchedAt: new Date().toISOString(), message: 'no Steam sync yet — run npm run sync:platforms' }))
app.get('/api/xbox', async (c) => c.json(await getStoredXboxSnapshot().catch(() => null) || { configured: false, profile: null, state: 'Unknown', currentGame: null, games: [], fetchedAt: new Date().toISOString(), message: 'no Xbox sync yet — run npm run sync:platforms' }))
app.get('/api/posts', async (c) => {
  const rawStatus = c.req.query('status') || 'published'
  const status = rawStatus === 'draft' || rawStatus === 'all' ? rawStatus : 'published'
  return c.json({ items: await repository.list(status) })
})
app.get('/api/posts/:slug', async (c) => {
  const post = await repository.get(c.req.param('slug'))
  return post ? c.json(post) : c.json({ message: 'Post not found' }, 404)
})
app.post('/api/posts', async (c) => {
  const adminToken = process.env.ADMIN_TOKEN
  if (adminToken && c.req.header('x-admin-token') !== adminToken) return c.json({ message: 'Unauthorized' }, 401)
  const parsed = postInputSchema.safeParse(await c.req.json())
  if (!parsed.success) return c.json({ message: 'Invalid post', issues: parsed.error.flatten() }, 400)
  return c.json(await repository.create(parsed.data), 201)
})

const port = Number(process.env.API_PORT || 8787)
serve({ fetch: app.fetch, port }, (info) => console.log(`aiisx API listening on http://localhost:${info.port}`))
