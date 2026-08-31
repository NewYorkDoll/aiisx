import { useEffect, useState } from 'react'
import { ExternalLink, X } from 'lucide-react'

type VideoDirective = { src: string; poster?: string | null; caption?: string }
type EmbedDirective = { url: string; caption?: string }

function httpUrl(value: unknown) {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function directive<T>(block: string, name: string) {
  if (!block.startsWith(`::${name}`)) return null
  try {
    return JSON.parse(block.slice(name.length + 2)) as T
  } catch {
    return null
  }
}

export function trustedEmbedUrl(value: string) {
  const source = httpUrl(value)
  if (!source) return null
  const url = new URL(source)
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

function imageBlock(block: string) {
  const match = block.match(/^!\[([^\]]*)]\((https?:\/\/[^\s)]+)\)$/)
  return match ? { caption: match[1], src: match[2] } : null
}

export function ArticleContent({ content, className = '' }: { content: string; className?: string }) {
  const [lightbox, setLightbox] = useState<{ src: string; caption: string } | null>(null)

  useEffect(() => {
    if (!lightbox) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [lightbox])

  const blocks = content.split(/\n\s*\n/).filter(Boolean)
  return <div className={`rich-content ${className}`.trim()}>
    {blocks.map((block, index) => {
      const image = imageBlock(block.trim())
      if (image) return <figure className="article-media article-image" key={`${index}-${image.src}`}>
        <button type="button" onClick={() => setLightbox(image)} aria-label={`放大图片${image.caption ? `：${image.caption}` : ''}`}>
          <img src={image.src} alt={image.caption} loading="lazy" decoding="async" />
        </button>
        {image.caption && <figcaption>{image.caption}</figcaption>}
      </figure>

      const video = directive<VideoDirective>(block.trim(), 'video')
      const videoSrc = httpUrl(video?.src)
      const poster = httpUrl(video?.poster)
      if (video && videoSrc) return <figure className="article-media article-video" key={`${index}-${videoSrc}`}>
        <video src={videoSrc} poster={poster || undefined} controls preload="metadata" playsInline />
        {video.caption && <figcaption>{video.caption}</figcaption>}
      </figure>

      const embed = directive<EmbedDirective>(block.trim(), 'embed')
      const embedUrl = embed?.url ? trustedEmbedUrl(embed.url) : null
      if (embed?.url) return <figure className="article-media article-embed" key={`${index}-${embed.url}`}>
        {embedUrl
          ? <iframe src={embedUrl} title={embed.caption || '视频播放器'} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
          : <a href={httpUrl(embed.url) || '#'} target="_blank" rel="noreferrer"><ExternalLink size={15} /> unsupported embed / open source</a>}
        {embed.caption && <figcaption>{embed.caption}</figcaption>}
      </figure>

      const heading = block.match(/^(#{1,3})\s+([\s\S]+)$/)
      if (heading) {
        if (heading[1].length === 1) return <h2 key={`${index}-${heading[2]}`}>{heading[2]}</h2>
        if (heading[1].length === 2) return <h3 key={`${index}-${heading[2]}`}>{heading[2]}</h3>
        return <h4 key={`${index}-${heading[2]}`}>{heading[2]}</h4>
      }
      if (block.split('\n').every((line) => /^[-*]\s+/.test(line))) {
        return <ul key={`${index}-${block}`}>{block.split('\n').map((line) => <li key={line}>{line.replace(/^[-*]\s+/, '')}</li>)}</ul>
      }
      if (block.startsWith('> ')) return <blockquote key={`${index}-${block}`}>{block.replace(/^>\s?/gm, '')}</blockquote>
      return <p key={`${index}-${block}`}>{block}</p>
    })}
    {lightbox && <div className="media-lightbox" role="dialog" aria-modal="true" aria-label={lightbox.caption || '图片预览'} onClick={() => setLightbox(null)}>
      <button type="button" onClick={() => setLightbox(null)} aria-label="关闭图片预览"><X size={22} /></button>
      <img src={lightbox.src} alt={lightbox.caption} onClick={(event) => event.stopPropagation()} />
      {lightbox.caption && <p>{lightbox.caption}</p>}
    </div>}
  </div>
}
