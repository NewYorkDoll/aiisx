import type { BlogPost, FitnessSnapshot, GameRecord, PostInput, SteamSnapshot, XboxSnapshot } from '../../shared/types'

const API_URL = import.meta.env.VITE_API_URL || ''

function adminHeaders(json = false) {
  const token = sessionStorage.getItem('aiisx-admin-token') || ''
  return { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(token ? { 'x-admin-token': token } : {}) }
}

export function setAdminToken(token: string) {
  if (token.trim()) sessionStorage.setItem('aiisx-admin-token', token.trim())
  else sessionStorage.removeItem('aiisx-admin-token')
}

export function getAdminToken() {
  return sessionStorage.getItem('aiisx-admin-token') || ''
}

export async function getPosts(status: 'published' | 'draft' | 'all' = 'published') {
  const response = await fetch(`${API_URL}/api/posts?status=${status}`, { headers: adminHeaders() })
  if (!response.ok) throw new Error('Unable to load journal')
  return (await response.json() as { items: BlogPost[] }).items
}

export async function getPost(slug: string) {
  const response = await fetch(`${API_URL}/api/posts/${encodeURIComponent(slug)}`, { headers: adminHeaders() })
  if (!response.ok) throw new Error('Unable to load journal entry')
  return await response.json() as BlogPost
}

export async function createPost(input: PostInput) {
  const response = await fetch(`${API_URL}/api/posts`, { method: 'POST', headers: adminHeaders(true), body: JSON.stringify(input) })
  if (!response.ok) throw new Error('Unable to save journal')
  return await response.json() as BlogPost
}

export async function updatePost(slug: string, input: PostInput) {
  const response = await fetch(`${API_URL}/api/posts/${encodeURIComponent(slug)}`, { method: 'PATCH', headers: adminHeaders(true), body: JSON.stringify(input) })
  if (!response.ok) throw new Error('Unable to update journal')
  return await response.json() as BlogPost
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
