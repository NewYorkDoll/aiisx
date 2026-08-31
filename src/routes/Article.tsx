import { useCallback } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, FilePenLine } from 'lucide-react'
import { Prompt, PromptInput } from '../components/Prompt'
import { ArticleContent } from '../components/ArticleContent'
import { Skeleton } from '../components/DataSkeleton'
import { getPost } from '../lib/api'
import { usePageMeta } from '../lib/meta'
import { useResource } from '../lib/resource'
import type { BlogPost } from '../../shared/types'

export default function Article() {
  const { slug } = useParams({ strict: false }) as { slug?: string }
  const loadPost = useCallback(() => slug ? getPost(slug) : Promise.reject(new Error('Missing slug')), [slug])
  const { data: post, error, loading } = useResource<BlogPost>(`article:${slug || 'missing'}`, loadPost, { persist: false, staleTime: 30_000 })

  usePageMeta({ title: post?.title || 'journal entry', description: post?.excerpt || 'aiisx journal entry', path: `/journal/${slug || ''}`, type: 'article' })

  if (error) return <div className="route-stack"><Prompt command={`journal --read ${slug || 'unknown'}`}><div className="article-empty"><p className="kicker">404 / NOT FOUND</p><h1>This note<br /><em>is missing.</em></h1><Link className="terminal-action" to="/">← back to journal</Link></div></Prompt><PromptInput /></div>
  if (loading || !post) return <div className="route-stack"><Prompt command={`journal --read ${slug || 'loading'}`}><article className="article-detail article-loading" aria-label="正在载入文章" aria-busy="true"><div className="article-topline"><Skeleton width="180px" /><Skeleton width="86px" /></div><Skeleton width="min(620px, 92%)" height="68px" /><Skeleton className="article-skeleton-media" width="100%" height="360px" /><div className="article-skeleton-copy"><Skeleton width="34%" /><Skeleton width="100%" /><Skeleton width="94%" /><Skeleton width="82%" /><Skeleton width="100%" /><Skeleton width="70%" /></div></article></Prompt><PromptInput /></div>

  return <div className="route-stack"><Prompt command={`journal --read ${post.slug}`}><article className="article-detail"><div className="article-topline"><span className="kicker">{post.mood} / {post.status}{post.tags.length ? ` / ${post.tags.map((tag) => `#${tag}`).join(' ')}` : ''}</span><time>{new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(new Date(post.publishedAt || post.updatedAt))}</time></div><h1>{post.title}</h1><ArticleContent content={post.content} className="article-body" /><div className="article-actions"><Link className="terminal-action secondary" to="/"> <ArrowLeft size={14} /> back to journal</Link>{post.status === 'draft' && <Link className="terminal-action secondary" to="/write/$slug" params={{ slug: post.slug }}><FilePenLine size={14} /> edit note</Link>}</div></article></Prompt><PromptInput /></div>
}
