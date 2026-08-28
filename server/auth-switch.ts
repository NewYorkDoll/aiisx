import crypto from 'node:crypto'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const clientId = process.env.SWITCH_CLIENT_ID || '5c38e31cd085304b'
const userAgent = 'com.nintendo.znej/1.13.0 (Android/7.1.2)'

function base64Url(value: Buffer) { return value.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }

async function main() {
  const verifier = base64Url(crypto.randomBytes(32))
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest())
  const params = new URLSearchParams({ state: '', redirect_uri: `npf${clientId}://auth`, client_id: clientId, scope: 'openid user user.mii user.email user.links[].id', response_type: 'session_token_code', session_token_code_challenge: challenge, session_token_code_challenge_method: 'S256', theme: 'login_form' })
  console.log('\nOpen this URL in your browser and log in to Nintendo Account:\n')
  console.log(`https://accounts.nintendo.com/connect/1.0.0/authorize?${params}\n`)
  console.log('After selecting your account, copy the complete redirect URL and paste it here.\n')
  const rl = readline.createInterface({ input, output })
  const redirectUrl = (await rl.question('redirect URL: ')).trim()
  rl.close()
  let code: string | null = null
  try {
    const url = new URL(redirectUrl)
    const fragment = new URLSearchParams(url.hash.replace(/^#/, ''))
    code = url.searchParams.get('session_token_code') || url.searchParams.get('de') || fragment.get('session_token_code') || fragment.get('de')
  } catch {
    code = redirectUrl.match(/[?#&](?:session_token_code|de)=([^&]+)/)?.[1] || null
  }
  if (!code) throw new Error('The pasted URL does not contain a de parameter.')
  const body = new URLSearchParams({ client_id: clientId, session_token_code: decodeURIComponent(code), session_token_code_verifier: verifier })
  const response = await fetch('https://accounts.nintendo.com/connect/1.0.0/api/session_token', { method: 'POST', headers: { 'User-Agent': userAgent, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  const result = await response.json() as { session_token?: string; error?: string; error_description?: string }
  if (!response.ok || !result.session_token) throw new Error(result.error_description || result.error || `Nintendo token exchange failed: ${response.status}`)
  console.log('\nSWITCH_SESSION_TOKEN=')
  console.log(result.session_token)
  console.log('\nCopy this value into aiisx-vite/.env. It is sensitive and should never be committed.\n')
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
