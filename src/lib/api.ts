import type { BlogPost, FitnessSnapshot, GameRecord, PostInput } from '../../shared/types'

const API_URL = import.meta.env.VITE_API_URL || ''

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
