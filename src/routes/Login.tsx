import { useEffect, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Prompt, PromptInput } from '../components/Prompt'
import { getAuthStatus, login } from '../lib/api'

export default function Login() {
  const navigate = useNavigate()
  const [token, setToken] = useState('')
  const [message, setMessage] = useState('')
  const [configured, setConfigured] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getAuthStatus().then((auth) => {
      setConfigured(auth.configured)
      if (auth.authenticated) void navigate({ to: '/journal/manage' })
    }).catch(() => setMessage('API 服务不可用'))
  }, [navigate])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try { await login(token); await navigate({ to: '/journal/manage' }) }
    catch (error) { setMessage(error instanceof Error ? error.message : '登录失败') }
    finally { setBusy(false) }
  }

  return <div className="route-stack"><Prompt command="auth --login"><div className="login-panel"><p className="kicker">PRIVATE CONSOLE</p><h1>Welcome<br /><em>back.</em></h1>{configured ? <form className="login-form" onSubmit={submit}><label><span><LockKeyhole size={13} /> admin token</span><input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="从 .env / ADMIN_TOKEN 读取" autoFocus required /></label><button type="submit" disabled={busy}>{busy ? 'authenticating...' : 'sign in'}</button>{message && <p className="form-message">{message}</p>}</form> : <p className="form-message">管理员登录尚未配置，请在服务端 .env 设置 ADMIN_TOKEN。</p>}</div></Prompt><PromptInput /></div>
}
