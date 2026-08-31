import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Prompt, PromptInput } from '../components/Prompt'
import { createPost, getAuthStatus, getPost, updatePost } from '../lib/api'

export default function Write() {
  const navigate = useNavigate()
  const { slug } = useParams({ strict: false }) as { slug?: string }
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [mood, setMood] = useState('curious')
  const [tags, setTags] = useState<string[]>([])
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(Boolean(slug))
  const [message, setMessage] = useState('')

  useEffect(() => {
    getAuthStatus().then((auth) => { if (!auth.authenticated) void navigate({ to: '/login' }) }).catch(() => setMessage('API 服务不可用'))
  }, [navigate])

  useEffect(() => {
    if (!slug) return
    getPost(slug).then((post) => {
      setTitle(post.title)
      setContent(post.content)
      setMood(post.mood)
      setTags(post.tags)
      setStatus(post.status)
    }).catch(() => setMessage('无法读取文章，请从管理页检查管理员令牌')).finally(() => setLoading(false))
  }, [slug])

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('')
    try {
      const input = { title, content, mood, tags, status }
      const post = slug ? await updatePost(slug, input) : await createPost(input)
      await navigate({ to: post.status === 'draft' ? '/journal/manage' : '/' })
    } catch { setMessage('保存失败，请检查管理员令牌或 API 服务') }
    finally { setSaving(false) }
  }
  return <div className="route-stack"><Prompt command={slug ? `journal --edit ${slug}` : 'journal --write'}><div className="write-toolbar"><span>{slug ? 'editing existing note' : 'new journal entry'}</span><Link to="/journal/manage">manage notes →</Link></div>{loading ? <p className="dim">loading note...</p> : <form className="write-form" onSubmit={submit}><label>title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A small thing worth keeping" required /></label><label>mood<input value={mood} onChange={(event) => setMood(event.target.value)} placeholder="curious" maxLength={32} /></label><label>body<textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="今天发生了什么？" rows={9} required /></label><div className="write-actions"><button type="submit" disabled={saving}>{saving ? 'saving...' : status === 'draft' ? 'save draft' : 'publish note'}</button><button type="button" className="secondary-action" onClick={() => setStatus(status === 'draft' ? 'published' : 'draft')}>{status === 'draft' ? 'switch to publish' : 'switch to draft'}</button></div>{message && <p className="form-message">{message}</p>}</form>}</Prompt><Prompt command="preview --plain"><div className="preview"><p className="kicker">{mood || 'mood'} / live preview</p><h2>{title || 'Untitled note'}</h2>{content ? content.split(/\n\s*\n/).map((paragraph, index) => <p key={`${index}-${paragraph}`}>{paragraph}</p>) : <p className="dim">Your note will appear here.</p>}</div></Prompt><PromptInput /></div>
}
