import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Prompt, PromptInput } from '../components/Prompt'
import { getPosts } from '../lib/api'
import type { BlogPost } from '../../shared/types'

const fallbackPost: BlogPost = { id: 'local', slug: 'keep-the-shell', title: 'Life, back in the shell.', content: '记录代码之外，正在玩的、正在练的，以及那些值得留下的普通日子。', excerpt: '记录代码之外，正在玩的、正在练的，以及那些值得留下的普通日子。', mood: 'curious', status: 'published', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), publishedAt: new Date().toISOString() }

export default function Journal() {
  const [posts, setPosts] = useState<BlogPost[]>([fallbackPost])
  const [connected, setConnected] = useState(false)
  useEffect(() => { getPosts().then((items) => { setPosts(items); setConnected(true) }).catch(() => undefined) }, [])
  const featured = posts[0] || fallbackPost
  return <div className="route-stack">
    <Prompt command="journal --today"><div className="journal-hero"><div><p className="kicker">{new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short' }).format(new Date())} / {featured.mood}</p><h1>{featured.title}<br /><em>{connected ? 'saved.' : 'in progress.'}</em></h1><p className="lede">{featured.excerpt}</p><div className="journal-actions"><Link className="terminal-action" to="/write">+ write a note</Link><Link className="terminal-action secondary" to="/journal/manage">manage notes</Link></div></div></div></Prompt>
    <div className="terminal-grid"><Prompt command="tail -n 3 journal.log"><div className="log-list">{posts.slice(0, 3).map((post) => <article className="log-entry" key={post.id}><time>{new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(post.updatedAt))}</time><div><h2>{post.title}</h2><p>{post.mood} / {post.status}</p></div><Link className="log-arrow" to="/journal/$slug" params={{ slug: post.slug }} aria-label={`阅读 ${post.title}`} title="阅读文章">↗</Link></article>)}</div></Prompt><Prompt command="status --now"><div className="status-readout"><div><span className="readout-label">notes / total</span><strong>{posts.length.toString().padStart(2, '0')}</strong></div><div><span className="readout-label">storage</span><strong>{connected ? 'api' : 'local'}</strong></div><div><span className="readout-label">mood</span><strong className="mood">{featured.mood}</strong></div></div></Prompt></div>
    <PromptInput />
  </div>
}
