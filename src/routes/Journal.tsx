import { Link } from '@tanstack/react-router'
import { Rss, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Prompt, PromptInput } from '../components/Prompt'
import { getFitness, getGames, getPosts, getSteam, getXbox } from '../lib/api'
import { buildActivityFeed, type ActivityItem } from '../lib/activity'
import { usePageMeta } from '../lib/meta'
import type { BlogPost, FitnessSnapshot, GameRecord, SteamSnapshot, XboxSnapshot } from '../../shared/types'

const fallbackPost: BlogPost = { id: 'local', slug: 'keep-the-shell', title: 'Life, back in the shell.', content: '记录代码之外，正在玩的、正在练的，以及那些值得留下的普通日子。', excerpt: '记录代码之外，正在玩的、正在练的，以及那些值得留下的普通日子。', mood: 'curious', tags: [], status: 'published', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), publishedAt: new Date().toISOString() }
const sourceLabels = { journal: 'note', switch: 'switch', steam: 'steam', xbox: 'xbox', training: 'gym' } as const

function activityDate(value: string) {
  const date = new Date(value)
  return `${String(date.getFullYear()).slice(-2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

function ActivityTarget({ item }: { item: ActivityItem }) {
  if (item.source === 'journal' && item.slug) return <Link className="activity-link" to="/journal/$slug" params={{ slug: item.slug }}>open</Link>
  if (item.source === 'training') return <Link className="activity-link" to="/fitness">open</Link>
  return <Link className="activity-link" to="/game-are-life">open</Link>
}

export default function Journal() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [switchGames, setSwitchGames] = useState<GameRecord[]>([])
  const [steam, setSteam] = useState<SteamSnapshot | null>(null)
  const [xbox, setXbox] = useState<XboxSnapshot | null>(null)
  const [fitness, setFitness] = useState<FitnessSnapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')

  usePageMeta({ title: 'yiziluoying / still online', description: '代码之外，正在玩的、正在练的，以及值得留下的普通日子。' })

  useEffect(() => {
    let active = true
    Promise.all([
      getPosts().then((items) => { if (active) { setPosts(items); setConnected(true) } }),
      getGames().then((items) => { if (active) setSwitchGames(items) }).catch(() => undefined),
      getSteam().then((data) => { if (active) setSteam(data) }).catch(() => undefined),
      getXbox().then((data) => { if (active) setXbox(data) }).catch(() => undefined),
      getFitness().then((data) => { if (active) setFitness(data) }).catch(() => undefined),
    ]).catch(() => undefined)
    return () => { active = false }
  }, [])

  const featured = posts[0] || fallbackPost
  const activity = useMemo(() => buildActivityFeed({ posts: connected ? posts : [], switchGames, steam, xbox, fitness }), [connected, fitness, posts, steam, switchGames, xbox])
  const tags = useMemo(() => [...new Set(posts.flatMap((post) => post.tags))].sort(), [posts])
  const filteredPosts = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return posts.filter((post) => (!tag || post.tags.includes(tag)) && (!needle || `${post.title} ${post.excerpt} ${post.mood} ${post.tags.join(' ')}`.toLowerCase().includes(needle)))
  }, [posts, query, tag])
  const latestGame = activity.find((item) => item.source === 'switch' || item.source === 'steam' || item.source === 'xbox')
  const latestTraining = activity.find((item) => item.source === 'training')

  return <div className="route-stack">
    <Prompt command="whoami --verbose"><div className="journal-hero"><p className="kicker">{new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short' }).format(new Date())} / PERSONAL SYSTEM</p><h1>yiziluoying.<br /><em>still online.</em></h1><p className="lede"><strong>{featured.title}</strong><span>{featured.excerpt}</span></p><div className="journal-actions"><Link className="terminal-action" to="/write">+ write a note</Link><Link className="terminal-action secondary" to="/journal/manage">manage notes</Link></div></div></Prompt>

    <div className="home-grid">
      <Prompt command="activity --merge journal,games,training --limit=10"><div className="activity-feed"><div className="activity-head"><span>TIME</span><span>SOURCE / EVENT</span><span>ACTION</span></div>{activity.map((item) => <article className="activity-row" data-source={item.source} key={item.id}><time>{activityDate(item.occurredAt)}</time><span className="activity-source">{sourceLabels[item.source]}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div><ActivityTarget item={item} /></article>)}{connected && !activity.length && <p className="dim">no recent activity</p>}{!connected && <p className="dim">connecting to life archive...</p>}</div></Prompt>
      <Prompt command="status --now"><div className="life-status"><div><span className="readout-label">journal</span><strong>{posts.length.toString().padStart(2, '0')}</strong><small>published notes</small></div><div><span className="readout-label">now playing</span><strong>{latestGame?.title || '—'}</strong><small>{latestGame?.source || 'waiting for sync'}</small></div><div><span className="readout-label">last training</span><strong>{latestTraining?.title || '—'}</strong><small>{latestTraining?.detail || 'waiting for sync'}</small></div></div></Prompt>
    </div>

    <Prompt command="rg --journal"><div className="journal-browser"><div className="journal-filter"><label><Search size={14} /><span className="sr-only">搜索文章</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="search notes..." /></label><select value={tag} onChange={(event) => setTag(event.target.value)} aria-label="按标签筛选"><option value="">all tags</option>{tags.map((item) => <option key={item} value={item}>#{item}</option>)}</select><a href="/rss.xml" aria-label="订阅 RSS" title="订阅 RSS"><Rss size={15} /></a></div><div className="journal-results">{filteredPosts.slice(0, 8).map((post) => <article key={post.id}><time>{new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(post.publishedAt || post.updatedAt))}</time><div><Link to="/journal/$slug" params={{ slug: post.slug }}>{post.title}</Link><p>{post.excerpt}</p>{post.tags.length > 0 && <span className="post-tags">{post.tags.map((item) => `#${item}`).join('  ')}</span>}</div></article>)}{!filteredPosts.length && <p className="dim">no matching notes</p>}</div></div></Prompt>
    <PromptInput />
  </div>
}
