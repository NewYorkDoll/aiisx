import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Prompt, PromptInput } from '../components/Prompt'
import { createPost } from '../lib/api'

export default function Write() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [mood, setMood] = useState('curious')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('')
    try { const post = await createPost({ title, content, mood, status }); await navigate({ to: '/' }); void post } catch { setMessage('api offline — start the TypeScript server first') } finally { setSaving(false) }
  }
  return <div className="route-stack"><Prompt command="journal --write"><form className="write-form" onSubmit={submit}><label>title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A small thing worth keeping" required /></label><label>mood<input value={mood} onChange={(event) => setMood(event.target.value)} placeholder="curious" maxLength={32} /></label><label>body<textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="今天发生了什么？" rows={9} required /></label><div className="write-actions"><button type="submit" disabled={saving}>{saving ? 'saving...' : status === 'draft' ? 'save draft' : 'publish note'}</button><button type="button" className="secondary-action" onClick={() => setStatus(status === 'draft' ? 'published' : 'draft')}>{status === 'draft' ? 'switch to publish' : 'switch to draft'}</button></div>{message && <p className="form-message">{message}</p>}</form></Prompt><Prompt command="preview --plain"><div className="preview"><p className="kicker">{mood || 'mood'} / live preview</p><h2>{title || 'Untitled note'}</h2>{content ? content.split(/\n\s*\n/).map((paragraph) => <p key={paragraph}>{paragraph}</p>) : <p className="dim">Your note will appear here.</p>}</div></Prompt><PromptInput /></div>
}
