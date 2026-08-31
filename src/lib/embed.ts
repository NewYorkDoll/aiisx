function httpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

export function trustedEmbedUrl(value: string) {
  const url = httpUrl(value)
  if (!url) return null
  const hostname = url.hostname.replace(/^www\./, '')
  if (hostname === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0]
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null
  }
  if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    const id = url.pathname === '/watch' ? url.searchParams.get('v') : parts[0] === 'shorts' || parts[0] === 'embed' ? parts[1] : null
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null
  }
  if (hostname === 'bilibili.com' || hostname === 'm.bilibili.com') {
    const id = url.pathname.split('/').find((part) => /^BV[\w]+$/i.test(part))
    return id ? `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(id)}&high_quality=1` : null
  }
  return null
}
