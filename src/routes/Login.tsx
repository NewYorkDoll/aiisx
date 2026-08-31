import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Prompt } from '../components/Prompt'
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
    catch (error) { setToken(''); setMessage(error instanceof Error ? error.message : '登录失败') }
    finally { setBusy(false) }
  }

  return <div className="route-stack"><Prompt command="sudo -u admin journal --manage"><div className="login-terminal"><p className="login-banner">AIISX PRIVILEGED SESSION</p><p className="login-output">authentication required for editorial access</p><p className="login-session">session / httpOnly / ttl 7d</p>{configured ? <>{message && <p className="login-status is-error"><span>!</span> {message}</p>}<form className="sudo-form" onSubmit={submit}><div className="sudo-password-line"><label htmlFor="admin-token">[sudo] password for aiisx:</label><input id="admin-token" type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="current-password" autoFocus required disabled={busy} aria-label="管理员密码" /><button className="sudo-submit" type="submit" disabled={busy}>提交认证</button></div>{busy && <p className="login-status"><span>›</span> verifying credentials...</p>}</form></> : <p className="login-status is-error"><span>!</span> auth: ADMIN_TOKEN is not configured</p>}</div></Prompt></div>
}
