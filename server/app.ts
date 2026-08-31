import 'dotenv/config'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { mediaCompleteInputSchema, mediaUploadInputSchema, postInputSchema } from '../shared/types.js'
import { listGames } from './db.js'
import { getStoredFitnessSnapshot, getStoredSteamSnapshot, getStoredXboxSnapshot } from './platform-store.js'
import { repository } from './repository.js'
import { listSyncRuns } from './sync-run-store.js'
import { clearLoginFailures, getLoginBlock, recordLoginFailure } from './login-rate-limit.js'
import { completeMediaUpload, createMediaUpload, deleteMediaAsset, getMediaAsset, listMediaAssets, mediaConfiguration } from './media-store.js'

const app = new Hono()
app.use('/api/*', cors())
app.use('*', async (c, next) => {
  await next()
  c.header('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; frame-src https://www.youtube.com https://player.bilibili.com; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; connect-src 'self' https://*.r2.cloudflarestorage.com; font-src 'self' data:")
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  if (process.env.NODE_ENV === 'production') c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
})

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

function loginClientKey(c: Context, secret: string) {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  const address = forwarded || c.req.header('cf-connecting-ip') || 'unknown'
  return createHmac('sha256', secret).update(address).digest('hex')
}

function xml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] || character)
}

function siteUrl() {
  return (process.env.SITE_URL || 'https://aiisx.com').replace(/\/$/, '')
}

app.post('/api/auth/login', async (c) => {
  const secret = process.env.ADMIN_TOKEN
  if (!secret) return c.json({ message: 'Admin login is not configured. Set ADMIN_TOKEN first.' }, 503)
  const clientKey = loginClientKey(c, secret)
  const blockedFor = await getLoginBlock(clientKey)
  if (blockedFor > 0) {
    c.header('Retry-After', String(blockedFor))
    return c.json({ message: 'Too many attempts; try again later' }, 429)
  }
  const body = await c.req.json().catch(() => ({})) as { token?: string }
  if (typeof body.token !== 'string' || body.token.length > 512 || !secureEqual(body.token, secret)) {
    const failure = await recordLoginFailure(clientKey)
    if (failure.retryAfter > 0) {
      c.header('Retry-After', String(failure.retryAfter))
      return c.json({ message: 'Too many attempts; try again later' }, 429)
    }
    return c.json({ message: `Invalid admin token; ${failure.attemptsRemaining} attempts remaining` }, 401)
  }
  await clearLoginFailures(clientKey)
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
async function rssFeed(c: Context) {
  const posts = await repository.list('published')
  const baseUrl = siteUrl()
  const items = posts.slice(0, 30).map((post) => `
    <item>
      <title>${xml(post.title)}</title>
      <link>${baseUrl}/journal/${encodeURIComponent(post.slug)}</link>
      <guid isPermaLink="true">${baseUrl}/journal/${encodeURIComponent(post.slug)}</guid>
      <description>${xml(post.excerpt)}</description>
      <pubDate>${new Date(post.publishedAt || post.updatedAt).toUTCString()}</pubDate>
      ${post.tags.map((tag) => `<category>${xml(tag)}</category>`).join('')}
    </item>`).join('')
  c.header('Content-Type', 'application/rss+xml; charset=utf-8')
  c.header('Cache-Control', 'no-store')
  return c.body(`<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"><channel>
  <title>aiisx / personal system</title>
  <link>${baseUrl}</link>
  <description>代码之外，正在玩的、正在练的，以及值得留下的普通日子。</description>
  <language>zh-CN</language>${items}
</channel></rss>`)
}

async function sitemap(c: Context) {
  const posts = await repository.list('published')
  const baseUrl = siteUrl()
  const routes = ['', '/game-are-life', '/fitness'].map((path) => `<url><loc>${baseUrl}${path}</loc></url>`)
  const articles = posts.map((post) => `<url><loc>${baseUrl}/journal/${encodeURIComponent(post.slug)}</loc><lastmod>${post.updatedAt}</lastmod></url>`)
  c.header('Content-Type', 'application/xml; charset=utf-8')
  c.header('Cache-Control', 'no-store')
  return c.body(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...routes, ...articles].join('')}</urlset>`)
}

app.get('/api/rss.xml', rssFeed)
app.get('/rss.xml', rssFeed)
app.get('/api/sitemap.xml', sitemap)
app.get('/sitemap.xml', sitemap)

app.get('/api/cron/:slot', async (c) => {
  if (!process.env.CRON_SECRET) return c.json({ message: 'Cron is not configured' }, 503)
  if (!isCronAuthorized(c)) return c.json({ message: 'Unauthorized' }, 401)
  const slot = c.req.param('slot')
  if (slot !== 'noon' && slot !== 'evening') return c.json({ message: 'Cron slot not found' }, 404)
    const { syncPlatforms } = await import('./sync-platforms.js')
  const result = await syncPlatforms({ trigger: 'cron', slot })
  const body = { slot, completedAt: new Date().toISOString(), ...result }
  return result.failed ? c.json(body, 502) : c.json(body)
})

app.get('/api/admin/sync-runs', async (c) => {
  if (!isAdmin(c)) return c.json({ message: 'Unauthorized' }, 401)
  const requestedLimit = Number(c.req.query('limit') || 12)
  return c.json({ items: await listSyncRuns(Number.isFinite(requestedLimit) ? requestedLimit : 12) })
})

app.get('/api/admin/media/config', (c) => {
  if (!isAdmin(c)) return c.json({ message: 'Unauthorized' }, 401)
  return c.json(mediaConfiguration())
})

app.get('/api/admin/media', async (c) => {
  if (!isAdmin(c)) return c.json({ message: 'Unauthorized' }, 401)
  const requestedLimit = Number(c.req.query('limit') || 60)
  return c.json({ items: await listMediaAssets(Number.isFinite(requestedLimit) ? requestedLimit : 60) })
})

app.post('/api/admin/media/presign', async (c) => {
  if (!isAdmin(c)) return c.json({ message: 'Unauthorized' }, 401)
  const parsed = mediaUploadInputSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ message: 'Invalid media upload', issues: parsed.error.flatten() }, 400)
  try {
    return c.json(await createMediaUpload(parsed.data), 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to prepare media upload'
    return c.json({ message }, message === 'Media storage is not configured' ? 503 : 400)
  }
})

app.post('/api/admin/media/:id/complete', async (c) => {
  if (!isAdmin(c)) return c.json({ message: 'Unauthorized' }, 401)
  const parsed = mediaCompleteInputSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ message: 'Invalid media metadata', issues: parsed.error.flatten() }, 400)
  try {
    const asset = await completeMediaUpload(c.req.param('id'), parsed.data)
    return asset ? c.json(asset) : c.json({ message: 'Media not found' }, 404)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to verify media upload'
    return c.json({ message }, message === 'Media storage is not configured' ? 503 : 502)
  }
})

app.delete('/api/admin/media/:id', async (c) => {
  if (!isAdmin(c)) return c.json({ message: 'Unauthorized' }, 401)
  const asset = await getMediaAsset(c.req.param('id'))
  if (!asset) return c.json({ message: 'Media not found' }, 404)
  if (await repository.countMediaReferences(asset.url)) {
    return c.json({ message: 'Media is still referenced by a journal post' }, 409)
  }
  try {
    return await deleteMediaAsset(asset.id) ? c.json({ deleted: true }) : c.json({ message: 'Media not found' }, 404)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete media'
    return c.json({ message }, message === 'Media storage is not configured' ? 503 : 502)
  }
})

app.get('/api/posts', async (c) => {
  const rawStatus = c.req.query('status') || 'published'
  const status = rawStatus === 'draft' || rawStatus === 'all' ? rawStatus : 'published'
  if (status !== 'published' && !isAdmin(c)) return c.json({ message: 'Unauthorized' }, 401)
  return c.json({ items: await repository.list(status, { query: c.req.query('q'), tag: c.req.query('tag') }) })
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
