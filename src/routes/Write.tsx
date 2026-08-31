import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Check, Cloud, HardDrive } from 'lucide-react'
import { Prompt, PromptInput } from '../components/Prompt'
import { ArticleContent } from '../components/ArticleContent'
import { MediaUploader } from '../components/MediaUploader'
import { createPost, getAuthStatus, getPost, updatePost } from '../lib/api'
import { usePageMeta } from '../lib/meta'
import type { PostInput } from '../../shared/types'

type LocalDraft = PostInput & { savedAt: number }

function parseTags(value: string) {
  return [...new Set(value.split(/[,，\s]+/).map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 6)
}

function fingerprint(input: PostInput) {
  return JSON.stringify(input)
}

function readDraft(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') as LocalDraft | null
  } catch {
    return null
  }
}

export default function Write() {
  const navigate = useNavigate()
  const { slug } = useParams({ strict: false }) as { slug?: string }
  const localKey = `aiisx:journal-draft:${slug || 'new'}:v1`
  const initialDraft = useMemo(() => slug ? null : readDraft(localKey), [localKey, slug])
  const [title, setTitle] = useState(initialDraft?.title || '')
  const [content, setContent] = useState(initialDraft?.content || '')
  const [mood, setMood] = useState(initialDraft?.mood || 'curious')
  const [tagsInput, setTagsInput] = useState(initialDraft?.tags.join(', ') || '')
  const [status, setStatus] = useState<'draft' | 'published'>(initialDraft?.status || 'draft')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(Boolean(slug))
  const [hydrated, setHydrated] = useState(!slug)
  const [message, setMessage] = useState('')
  const [autosave, setAutosave] = useState(initialDraft ? 'recovered from this browser' : 'waiting for input')
  const [serverStatus, setServerStatus] = useState<'draft' | 'published' | null>(null)
  const lastSavedFingerprint = useRef('')
  const textarea = useRef<HTMLTextAreaElement>(null)

  const tags = useMemo(() => parseTags(tagsInput), [tagsInput])
  const input = useMemo<PostInput>(() => ({ title, content, mood, tags, status }), [content, mood, status, tags, title])

  usePageMeta({ title: slug ? 'edit journal entry' : 'write journal entry', description: 'aiisx journal editor', path: slug ? `/write/${slug}` : '/write' })

  useEffect(() => {
    getAuthStatus().then((auth) => { if (!auth.authenticated) void navigate({ to: '/login' }) }).catch(() => setMessage('API 服务不可用'))
  }, [navigate])

  useEffect(() => {
    let active = true
    if (!slug) {
      return () => { active = false }
    }

    getPost(slug).then((post) => {
      if (!active) return
      const serverInput: PostInput = { title: post.title, content: post.content, mood: post.mood, tags: post.tags, status: post.status }
      const local = readDraft(localKey)
      const restoreLocal = local && local.savedAt > new Date(post.updatedAt).getTime()
      const source = restoreLocal ? local : serverInput
      setTitle(source.title)
      setContent(source.content)
      setMood(source.mood)
      setTagsInput(source.tags.join(', '))
      setStatus(source.status)
      setServerStatus(post.status)
      lastSavedFingerprint.current = fingerprint(serverInput)
      setAutosave(restoreLocal ? 'recovered unsaved changes' : 'up to date')
    }).catch(() => setMessage('无法读取文章，请从管理页检查登录状态')).finally(() => {
      if (active) { setLoading(false); setHydrated(true) }
    })
    return () => { active = false }
  }, [localKey, slug])

  useEffect(() => {
    if (!hydrated) return
    const timer = window.setTimeout(() => {
      if (!title.trim() && !content.trim()) {
        localStorage.removeItem(localKey)
        setAutosave('waiting for input')
        return
      }
      localStorage.setItem(localKey, JSON.stringify({ ...input, savedAt: Date.now() } satisfies LocalDraft))
      setAutosave(`saved locally / ${new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`)
    }, 600)
    return () => window.clearTimeout(timer)
  }, [content, hydrated, input, localKey, title])

  useEffect(() => {
    if (!hydrated || !slug || saving || serverStatus !== 'draft' || status !== 'draft' || !title.trim() || !content.trim()) return
    const currentFingerprint = fingerprint(input)
    if (currentFingerprint === lastSavedFingerprint.current) return
    const timer = window.setTimeout(() => {
      setAutosave('syncing draft...')
      updatePost(slug, input).then(() => {
        lastSavedFingerprint.current = currentFingerprint
        localStorage.removeItem(localKey)
        setAutosave(`synced / ${new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`)
      }).catch(() => setAutosave('local copy saved / sync failed'))
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [content, hydrated, input, localKey, saving, serverStatus, slug, status, title])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const post = slug ? await updatePost(slug, input) : await createPost(input)
      localStorage.removeItem(localKey)
      await navigate({ to: post.status === 'draft' ? '/journal/manage' : '/journal/$slug', params: post.status === 'published' ? { slug: post.slug } : undefined })
    } catch {
      setMessage('保存失败，请检查登录状态或 API 服务')
    } finally {
      setSaving(false)
    }
  }

  function insertMedia(snippet: string) {
    const field = textarea.current
    const start = field?.selectionStart ?? content.length
    const end = field?.selectionEnd ?? start
    const before = content.slice(0, start).replace(/\s*$/, '')
    const after = content.slice(end).replace(/^\s*/, '')
    const insertion = `${before ? '\n\n' : ''}${snippet}${after ? '\n\n' : ''}`
    const next = `${before}${insertion}${after}`
    const cursor = before.length + insertion.length
    setContent(next)
    requestAnimationFrame(() => { textarea.current?.focus(); textarea.current?.setSelectionRange(cursor, cursor) })
  }

  return <div className="route-stack"><Prompt command={slug ? `journal --edit ${slug}` : 'journal --write'}><div className="write-toolbar"><span>{slug ? 'editing existing note' : 'new journal entry'}</span><span className="autosave-status"><HardDrive size={12} /> {autosave}</span><Link to="/journal/manage">manage notes →</Link></div>{loading ? <p className="dim">loading note...</p> : <form className="write-form" onSubmit={submit}><label>title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A small thing worth keeping" required /></label><div className="write-meta-grid"><label>mood<input value={mood} onChange={(event) => setMood(event.target.value)} placeholder="curious" maxLength={32} /></label><label>tags<input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} placeholder="life, code, training" maxLength={160} /><small>{tags.length}/6 / comma separated</small></label></div><label>body<MediaUploader onInsert={insertMedia} /><textarea ref={textarea} value={content} onChange={(event) => setContent(event.target.value)} placeholder="今天发生了什么？" rows={12} required /></label><div className="write-actions"><button type="submit" disabled={saving}>{saving ? 'saving...' : status === 'draft' ? 'save draft' : 'publish note'}</button><button type="button" className="secondary-action" onClick={() => setStatus(status === 'draft' ? 'published' : 'draft')}>{status === 'draft' ? 'switch to publish' : 'switch to draft'}</button><span className="write-persistence">{serverStatus === 'draft' && status === 'draft' ? <><Cloud size={13} /> server autosave</> : <><Check size={13} /> browser recovery</>}</span></div>{message && <p className="form-message">{message}</p>}</form>}</Prompt><Prompt command="preview --plain"><div className="preview"><p className="kicker">{mood || 'mood'}{tags.length ? ` / ${tags.map((tag) => `#${tag}`).join(' ')}` : ''} / live preview</p><h2>{title || 'Untitled note'}</h2>{content ? <ArticleContent content={content} /> : <p className="dim">Your note will appear here.</p>}</div></Prompt><PromptInput /></div>
}
