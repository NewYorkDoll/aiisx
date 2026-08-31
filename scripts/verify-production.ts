type Check = {
  path: string
  validate: (response: Response, body: unknown) => boolean
}

const checks: Check[] = [
  {
    path: '/api/health',
    validate: (response, body) =>
      response.ok && typeof body === 'object' && body !== null && 'ok' in body && body.ok === true,
  },
  {
    path: '/api/games',
    validate: (response, body) => response.ok && isRecord(body) && Array.isArray(body.items),
  },
  {
    path: '/api/steam',
    validate: (response, body) => response.ok && isRecord(body) && Array.isArray(body.games),
  },
  {
    path: '/api/xbox',
    validate: (response, body) => response.ok && isRecord(body) && Array.isArray(body.games),
  },
  {
    path: '/api/fitness',
    validate: (response, body) => response.ok && isRecord(body) && Array.isArray(body.recentActions),
  },
  {
    path: '/login',
    validate: (response, body) => response.ok && typeof body === 'string' && body.includes('<div id="root">'),
  },
  {
    path: '/rss.xml',
    validate: (response, body) => response.ok && typeof body === 'string' && body.includes('<rss version="2.0">'),
  },
  {
    path: '/sitemap.xml',
    validate: (response, body) => response.ok && typeof body === 'string' && body.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'),
  },
]

const baseUrl = new URL(process.argv[2] ?? process.env.PRODUCTION_URL ?? 'https://aiisx.com')
const retries = 3

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function runCheck(check: Check) {
  const url = new URL(check.path, baseUrl)

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const startedAt = performance.now()

    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'aiisx-production-health/1.0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(15_000),
      })
      const contentType = response.headers.get('content-type') ?? ''
      const body = contentType.includes('application/json') ? await response.json() : await response.text()
      const duration = Math.round(performance.now() - startedAt)

      if (check.validate(response, body)) {
        console.log(`[health] pass ${check.path} ${response.status} ${duration}ms`)
        return
      }

      throw new Error(`unexpected response ${response.status} (${contentType || 'unknown content type'})`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (attempt === retries) {
        throw new Error(`${check.path}: ${message}`)
      }

      console.warn(`[health] retry ${check.path} ${attempt}/${retries}: ${message}`)
      await wait(attempt * 2_000)
    }
  }
}

console.log(`[health] checking ${baseUrl.origin}`)

const results = await Promise.allSettled(checks.map(runCheck))
const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[health] fail ${failure.reason instanceof Error ? failure.reason.message : failure.reason}`)
  }
  process.exitCode = 1
} else {
  console.log(`[health] all ${checks.length} checks passed`)
}
