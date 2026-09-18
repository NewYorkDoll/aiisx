import { database, ensureDatabaseSchema } from './database.js'

// The caller supplies a stored game ID, never a URL. Only official image CDNs are fetched.
export async function getGameCover(id: string): Promise<Response> {
  const error = (status: number) => new Response('Cover unavailable', { status, headers: { 'Cache-Control': 'no-store' } })
  const match = id.match(/^(switch|steam|pc|xbox):([\w-]{1,100})$/)
  if (!match) return error(400)
  await ensureDatabaseSchema()
  const sql = match[1] === 'switch'
    ? 'SELECT zh_cover AS cover FROM dwd_switch_game_played_record WHERE title_id = ? ORDER BY last_played_at DESC LIMIT 1'
    : match[1] === 'steam' ? 'SELECT cover FROM steam_game_activity WHERE app_id = ?'
      : 'SELECT cover FROM xbox_game_activity WHERE title_id = ?'
  const result = await database.execute({ sql, args: [match[2]] })
  const cover = result.rows[0]?.cover
  if (!cover) return error(404)
  try {
    const url = new URL(String(cover))
    const allowedHosts = ['atum-img-lp1.cdn.nintendo.net', 'img-eshop.cdn.nintendo.net', 'cdn.cloudflare.steamstatic.com', 'cdn.akamai.steamstatic.com', 'shared.fastly.steamstatic.com', 'store-images.s-microsoft.com', 'images-eds-ssl.xboxlive.com']
    if (!allowedHosts.includes(url.hostname) || !['http:', 'https:'].includes(url.protocol) || url.port || url.username || url.password) return error(404)
    url.protocol = 'https:'
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000), redirect: 'error' })
    const type = response.headers.get('content-type')?.split(';')[0].trim()
    const limit = 4 * 1024 * 1024
    if (!response.ok || !type || !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(type) || Number(response.headers.get('content-length')) > limit) {
      await response.body?.cancel()
      return error(502)
    }
    const reader = response.body?.getReader()
    if (!reader) return error(502)
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) { await reader.cancel(); return error(502) }
      chunks.push(value)
    }
    if (!size) return error(502)
    return new Response(Buffer.concat(chunks), { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400, s-maxage=604800', 'X-Content-Type-Options': 'nosniff' } })
  } catch { return error(502) }
}
