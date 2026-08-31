import { useEffect, useState } from 'react'
import { Eye, EyeOff, FilePenLine, LogOut, RefreshCw, Trash2 } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Prompt, PromptInput } from '../components/Prompt'
import { deletePost, getAuthStatus, getPosts, getSyncRuns, logout, updatePost } from '../lib/api'
import type { BlogPost, SyncRun } from '../../shared/types'

export default function Manage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([])
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState<'error' | 'success'>('error')
  const [loading, setLoading] = useState(true)
  const [busySlug, setBusySlug] = useState('')
  const [confirmSlug, setConfirmSlug] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    getAuthStatus()
      .then(async (auth) => { if (!auth.authenticated) { await navigate({ to: '/login' }); return }; return Promise.all([getPosts('all'), getSyncRuns()]) })
      .then((result) => { if (active && result) { setPosts(result[0]); setSyncRuns(result[1]) } })
      .catch(() => { if (active) { setMessageKind('error'); setMessage('无法读取文章，请检查管理员令牌或 API 服务') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [navigate])

  async function signOut() { await logout(); await navigate({ to: '/login' }) }

  async function refreshSyncRuns() {
    setMessage('')
    try { setSyncRuns(await getSyncRuns()) }
    catch { setMessageKind('error'); setMessage('同步记录读取失败，请稍后重试') }
  }

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
    } catch { setMessageKind('error'); setMessage('状态更新失败，请检查管理员令牌') }
    finally { setBusySlug('') }
  }

  async function removePost(post: BlogPost) {
    setBusySlug(post.slug)
    setMessage('')
    try {
      await deletePost(post.slug)
      setPosts((items) => items.filter((item) => item.id !== post.id))
      setConfirmSlug('')
      setMessageKind('success')
      setMessage(`deleted / ${post.title}`)
    } catch {
      setMessageKind('error')
      setMessage('删除失败，请检查管理员令牌或 API 服务')
    } finally { setBusySlug('') }
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
      <Prompt command="systemctl status aiisx-sync --history">
        <div className="sync-heading">
          <div><span className="readout-label">platform scheduler</span><strong>sync history</strong></div>
          <button type="button" onClick={() => void refreshSyncRuns()} title="刷新同步记录" aria-label="刷新同步记录"><RefreshCw size={15} /></button>
        </div>
        <div className="sync-history">
          {syncRuns.map((run) => (
            <article className="sync-run" key={run.id}>
              <div className="sync-run-meta">
                <time>{new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(run.startedAt))}</time>
                <span>{run.trigger}{run.slot ? ` / ${run.slot}` : ''}</span>
              </div>
              <div className="sync-run-state">
                <strong data-status={run.status}>{run.status}</strong>
                <span>{run.succeeded} ok / {run.failed} failed / {run.durationMs === null ? 'running' : `${(run.durationMs / 1000).toFixed(1)}s`}</span>
              </div>
              <div className="sync-platforms">
                {run.items.map((item) => <span key={item.id} data-status={item.status} title={item.message || item.status}>{item.platform}</span>)}
              </div>
            </article>
          ))}
          {!loading && !syncRuns.length && <p className="dim">no sync history yet / next cron run will appear here</p>}
        </div>
      </Prompt>
      <Prompt command="ls journal/* --all">
        <div className="manage-list">
          {loading ? <p className="dim">loading notes...</p> : posts.map((post) => (
            <article className={`manage-row ${confirmSlug === post.slug ? 'confirming' : ''}`} key={post.id}>
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
                <button type="button" onClick={() => { setMessage(''); setConfirmSlug(post.slug) }} disabled={busySlug === post.slug} aria-label={`删除 ${post.title}`} title="删除文章"><Trash2 size={16} /></button>
              </div>
              {confirmSlug === post.slug && <div className="delete-confirm" role="alertdialog" aria-labelledby={`delete-${post.id}`}>
                <span id={`delete-${post.id}`}><Trash2 size={13} /> rm --force &quot;{post.title}&quot;?</span>
                <div>
                  <button type="button" className="confirm-delete" onClick={() => void removePost(post)} disabled={busySlug === post.slug}>delete</button>
                  <button type="button" onClick={() => setConfirmSlug('')} disabled={busySlug === post.slug}>cancel</button>
                </div>
              </div>}
            </article>
          ))}
          {!loading && !posts.length && !message && <p className="dim">no notes yet</p>}
          {message && <p className={`manage-message ${messageKind}`} aria-live="polite">{message}</p>}
        </div>
      </Prompt>
      <PromptInput />
    </div>
  )
}
