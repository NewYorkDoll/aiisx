import { useEffect, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, FilePenLine } from 'lucide-react'
import { Prompt, PromptInput } from '../components/Prompt'
import { getPost } from '../lib/api'
import type { BlogPost } from '../../shared/types'

export default function Article() {
  const { slug } = useParams({ strict: false }) as { slug?: string }
  const [post, setPost] = useState<BlogPost | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!slug) return
    getPost(slug).then(setPost).catch(() => setError(true))
  }, [slug])

  if (error) return <div className="route-stack"><Prompt command={`journal --read ${slug || 'unknown'}`}><div className="article-empty"><p className="kicker">404 / NOT FOUND</p><h1>This note<br /><em>is missing.</em></h1><Link className="terminal-action" to="/">← back to journal</Link></div></Prompt><PromptInput /></div>
  if (!post) return <div className="route-stack"><Prompt command={`journal --read ${slug || 'loading'}`}><p className="dim">loading note...</p></Prompt><PromptInput /></div>

  return <div className="route-stack"><Prompt command={`journal --read ${post.slug}`}><article className="article-detail"><div className="article-topline"><span className="kicker">{post.mood} / {post.status}</span><time>{new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(new Date(post.publishedAt || post.updatedAt))}</time></div><h1>{post.title}</h1><p className="article-excerpt">{post.excerpt}</p><div className="article-body">{post.content.split(/\n\s*\n/).map((paragraph, index) => <p key={`${index}-${paragraph}`}>{paragraph}</p>)}</div><div className="article-actions"><Link className="terminal-action secondary" to="/"> <ArrowLeft size={14} /> back to journal</Link>{post.status === 'draft' && <Link className="terminal-action secondary" to="/write/$slug" params={{ slug: post.slug }}><FilePenLine size={14} /> edit note</Link>}</div></article></Prompt><PromptInput /></div>
}
