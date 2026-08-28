import { useEffect, useState } from 'react'
import { Eye, EyeOff, FilePenLine, LogOut } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Prompt, PromptInput } from '../components/Prompt'
import { getAuthStatus, getPosts, logout, updatePost } from '../lib/api'
import type { BlogPost } from '../../shared/types'

export default function Manage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busySlug, setBusySlug] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    getAuthStatus()
      .then(async (auth) => { if (!auth.authenticated) { await navigate({ to: '/login' }); return }; return getPosts('all') })
      .then((items) => { if (active && items) setPosts(items) })
      .catch(() => { if (active) setMessage('无法读取文章，请检查管理员令牌或 API 服务') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [navigate])

  async function signOut() { await logout(); await navigate({ to: '/login' }) }

  async function toggleStatus(post: BlogPost) {
    setBusySlug(post.slug)
    setMessage('')
    try {
      const updated = await updatePost(post.slug, {
        title: post.title,
        content: post.content,
        mood: post.mood,
        status: post.status === 'draft' ? 'published' : 'draft',
      })
      setPosts((items) => items.map((item) => item.id === updated.id ? updated : item))
    } catch { setMessage('状态更新失败，请检查管理员令牌') }
    finally { setBusySlug('') }
  }

  const draftCount = posts.filter((post) => post.status === 'draft').length

  return (
    <div className="route-stack">
      <Prompt command="journal --manage">
        <div className="manage-heading">
          <div>
            <p className="kicker">EDITORIAL QUEUE</p>
            <h1>Notes,<br /><em>under control.</em></h1>
          </div>
          <div className="manage-counts">
            <span><strong>{posts.length}</strong> total</span>
            <span><strong>{draftCount}</strong> drafts</span>
          </div>
        </div>
        <div className="admin-session"><span>authenticated session / 7 days</span><button type="button" onClick={() => void signOut()} title="退出登录"><LogOut size={14} /><span>sign out</span></button></div>
      </Prompt>
      <Prompt command="ls journal/* --all">
        <div className="manage-list">
          {loading ? <p className="dim">loading notes...</p> : posts.map((post) => (
            <article className="manage-row" key={post.id}>
              <div className="manage-meta">
                <span className={`post-status ${post.status}`}>{post.status}</span>
                <time>{new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(post.updatedAt))}</time>
              </div>
              <div className="manage-copy">
                <h2>{post.title}</h2>
                <p>{post.excerpt}</p>
              </div>
              <div className="manage-actions">
                <Link to="/write/$slug" params={{ slug: post.slug }} aria-label={`编辑 ${post.title}`} title="编辑文章"><FilePenLine size={16} /></Link>
                <button type="button" onClick={() => void toggleStatus(post)} disabled={busySlug === post.slug} aria-label={post.status === 'draft' ? `发布 ${post.title}` : `撤回 ${post.title}`} title={post.status === 'draft' ? '发布文章' : '撤回为草稿'}>
                  {post.status === 'draft' ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            </article>
          ))}
          {!loading && !posts.length && !message && <p className="dim">no notes yet</p>}
          {message && <p className="form-message">{message}</p>}
        </div>
      </Prompt>
      <PromptInput />
    </div>
  )
}
