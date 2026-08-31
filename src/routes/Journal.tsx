import { Link } from '@tanstack/react-router'
import { Rss, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Skeleton } from '../components/DataSkeleton'
import { Prompt, PromptInput } from '../components/Prompt'
import { getFitness, getGames, getPosts, getSteam, getXbox } from '../lib/api'
import { buildActivityFeed, type ActivityItem } from '../lib/activity'
import { usePageMeta } from '../lib/meta'
import { useResource } from '../lib/resource'
import type { BlogPost, FitnessSnapshot, GameRecord, SteamSnapshot, XboxSnapshot } from '../../shared/types'

const sourceLabels = { journal: 'note', switch: 'switch', steam: 'steam', xbox: 'xbox', training: 'gym' } as const
const emptyPosts: BlogPost[] = []
const emptyGames: GameRecord[] = []

type JournalSnapshot = {
  fitness: FitnessSnapshot | null
  posts: BlogPost[]
  steam: SteamSnapshot | null
  switchGames: GameRecord[]
  xbox: XboxSnapshot | null
}

async function loadJournalSnapshot(): Promise<JournalSnapshot> {
  const [posts, switchGames, steam, xbox, fitness] = await Promise.all([
    getPosts(),
    getGames().catch(() => []),
    getSteam().catch(() => null),
    getXbox().catch(() => null),
    getFitness().catch(() => null),
  ])
  return { fitness, posts, steam, switchGames, xbox }
}

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
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const { data, error, loading, refreshing } = useResource('journal:home', loadJournalSnapshot)
  const posts = data?.posts || emptyPosts
  const switchGames = data?.switchGames || emptyGames
  const steam = data?.steam || null
  const xbox = data?.xbox || null
  const fitness = data?.fitness || null
  const pending = loading && !data

  usePageMeta({ title: 'yiziluoying / still online', description: '代码之外，正在玩的、正在练的，以及值得留下的普通日子。' })

  const featured = posts[0] || null
  const activity = useMemo(() => buildActivityFeed({ posts, switchGames, steam, xbox, fitness }), [fitness, posts, steam, switchGames, xbox])
  const tags = useMemo(() => [...new Set(posts.flatMap((post) => post.tags))].sort(), [posts])
  const filteredPosts = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return posts.filter((post) => (!tag || post.tags.includes(tag)) && (!needle || `${post.title} ${post.excerpt} ${post.mood} ${post.tags.join(' ')}`.toLowerCase().includes(needle)))
  }, [posts, query, tag])
  const latestGame = activity.find((item) => item.source === 'switch' || item.source === 'steam' || item.source === 'xbox')
  const latestTraining = activity.find((item) => item.source === 'training')

  return <div className="route-stack data-view" aria-busy={pending || refreshing}>
    <Prompt command="whoami --verbose"><div className="journal-hero"><p className="kicker">{new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short' }).format(new Date())} / PERSONAL SYSTEM</p><h1>yiziluoying.<br /><em>still online.</em></h1><p className="lede">{featured ? <><strong>{featured.title}</strong><span>{featured.excerpt}</span></> : pending ? <><Skeleton width="260px" height="16px" /><Skeleton width="min(520px, 100%)" height="38px" /></> : <><strong>life archive unavailable</strong><span>{error?.message || 'try again later'}</span></>}</p><div className="journal-actions"><Link className="terminal-action" to="/write">+ write a note</Link><Link className="terminal-action secondary" to="/journal/manage">manage notes</Link></div></div></Prompt>

    <div className="home-grid">
      <Prompt command="activity --merge journal,games,training --limit=10"><div className="activity-feed"><div className="activity-head"><span>TIME</span><span>SOURCE / EVENT</span><span>ACTION</span></div>{pending ? Array.from({ length: 5 }, (_, index) => <article className="activity-row skeleton-row" key={index}><Skeleton width="38px" /><Skeleton width="32px" /><div><Skeleton width="68%" /><Skeleton width="90%" /></div><Skeleton width="28px" /></article>) : activity.map((item) => <article className="activity-row data-reveal" data-source={item.source} key={item.id}><time>{activityDate(item.occurredAt)}</time><span className="activity-source">{sourceLabels[item.source]}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div><ActivityTarget item={item} /></article>)}{data && !activity.length && <p className="dim">no recent activity</p>}</div></Prompt>
      <Prompt command="status --now"><div className="life-status"><div><span className="readout-label">journal</span><strong>{pending ? <Skeleton width="44px" height="28px" /> : posts.length.toString().padStart(2, '0')}</strong><small>published notes</small></div><div><span className="readout-label">now playing</span><strong>{pending ? <Skeleton width="72%" height="16px" /> : latestGame?.title || '—'}</strong><small>{pending ? <Skeleton width="48%" /> : latestGame?.source || 'waiting for sync'}</small></div><div><span className="readout-label">last training</span><strong>{pending ? <Skeleton width="68%" height="16px" /> : latestTraining?.title || '—'}</strong><small>{pending ? <Skeleton width="82%" /> : latestTraining?.detail || 'waiting for sync'}</small></div></div></Prompt>
    </div>

    <Prompt command="rg --journal"><div className="journal-browser"><div className="journal-filter"><label><Search size={14} /><span className="sr-only">搜索文章</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="search notes..." /></label><select value={tag} onChange={(event) => setTag(event.target.value)} aria-label="按标签筛选"><option value="">all tags</option>{tags.map((item) => <option key={item} value={item}>#{item}</option>)}</select><a href="/rss.xml" aria-label="订阅 RSS" title="订阅 RSS"><Rss size={15} /></a></div><div className="journal-results">{pending ? Array.from({ length: 3 }, (_, index) => <article className="skeleton-row" key={index}><Skeleton width="70px" /><div><Skeleton width="46%" height="14px" /><Skeleton width="92%" /><Skeleton width="34%" /></div></article>) : filteredPosts.slice(0, 8).map((post) => <article className="data-reveal" key={post.id}><time>{new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(post.publishedAt || post.updatedAt))}</time><div><Link to="/journal/$slug" params={{ slug: post.slug }}>{post.title}</Link><p>{post.excerpt}</p>{post.tags.length > 0 && <span className="post-tags">{post.tags.map((item) => `#${item}`).join('  ')}</span>}</div></article>)}{data && !filteredPosts.length && <p className="dim">no matching notes</p>}</div></div></Prompt>
    <PromptInput />
  </div>
}
