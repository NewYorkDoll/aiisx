import type { BlogPost, FitnessSnapshot, GameRecord, PostInput, SteamSnapshot, XboxSnapshot } from '../../shared/types'

const API_URL = import.meta.env.VITE_API_URL || ''

function adminHeaders(json = false): HeadersInit { return json ? { 'Content-Type': 'application/json' } : {} }

export async function getAuthStatus() {
  const response = await fetch(`${API_URL}/api/auth/me`, { credentials: 'include' })
  if (!response.ok) throw new Error('Unable to check auth')
  return await response.json() as { authenticated: boolean; configured: boolean }
}

export async function login(token: string) {
  const response = await fetch(`${API_URL}/api/auth/login`, { method: 'POST', headers: adminHeaders(true), credentials: 'include', body: JSON.stringify({ token }) })
  if (!response.ok) { const body = await response.json().catch(() => ({})) as { message?: string }; throw new Error(body.message || 'Unable to sign in') }
}

export async function logout() {
  await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' })
}

export async function getPosts(status: 'published' | 'draft' | 'all' = 'published') {
  const response = await fetch(`${API_URL}/api/posts?status=${status}`, { headers: adminHeaders(), credentials: 'include' })
  if (!response.ok) throw new Error('Unable to load journal')
  return (await response.json() as { items: BlogPost[] }).items
}

export async function getPost(slug: string) {
  const response = await fetch(`${API_URL}/api/posts/${encodeURIComponent(slug)}`, { headers: adminHeaders(), credentials: 'include' })
  if (!response.ok) throw new Error('Unable to load journal entry')
  return await response.json() as BlogPost
}

export async function createPost(input: PostInput) {
  const response = await fetch(`${API_URL}/api/posts`, { method: 'POST', headers: adminHeaders(true), credentials: 'include', body: JSON.stringify(input) })
  if (!response.ok) throw new Error('Unable to save journal')
  return await response.json() as BlogPost
}

export async function updatePost(slug: string, input: PostInput) {
  const response = await fetch(`${API_URL}/api/posts/${encodeURIComponent(slug)}`, { method: 'PATCH', headers: adminHeaders(true), credentials: 'include', body: JSON.stringify(input) })
  if (!response.ok) throw new Error('Unable to update journal')
  return await response.json() as BlogPost
}

export async function deletePost(slug: string) {
  const response = await fetch(`${API_URL}/api/posts/${encodeURIComponent(slug)}`, { method: 'DELETE', headers: adminHeaders(), credentials: 'include' })
  if (!response.ok) throw new Error('Unable to delete journal entry')
}

export async function getGames() {
  const response = await fetch(`${API_URL}/api/games`)
  if (!response.ok) throw new Error('Unable to load games')
  return (await response.json() as { items: GameRecord[] }).items
}

export async function getFitness() {
  const response = await fetch(`${API_URL}/api/fitness`)
  if (!response.ok) throw new Error('Unable to load training')
  return await response.json() as FitnessSnapshot
}

export async function getSteam() {
  const response = await fetch(`${API_URL}/api/steam`)
  if (!response.ok) throw new Error('Unable to load Steam')
  return await response.json() as SteamSnapshot
}

export async function getXbox() {
  const response = await fetch(`${API_URL}/api/xbox`)
  if (!response.ok) throw new Error('Unable to load Xbox')
  return await response.json() as XboxSnapshot
}
