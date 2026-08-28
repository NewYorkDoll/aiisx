import type { BlogPost, PostInput } from '../../shared/types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

export async function getPosts() {
  const response = await fetch(`${API_URL}/api/posts`)
  if (!response.ok) throw new Error('Unable to load journal')
  return (await response.json() as { items: BlogPost[] }).items
}

export async function createPost(input: PostInput) {
  const response = await fetch(`${API_URL}/api/posts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
  if (!response.ok) throw new Error('Unable to save journal')
  return await response.json() as BlogPost
}
