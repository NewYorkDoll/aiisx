import { randomUUID } from 'node:crypto'
import type { BlogPost, PostInput } from '../shared/types'

const now = new Date().toISOString()
const posts: BlogPost[] = [
  {
    id: 'welcome',
    slug: 'keep-the-shell',
    title: '把博客重新装回自己的 Shell',
    content: '这是一个新的开始。\n\n我想记录代码之外，正在玩的、正在练的，以及那些值得留下的普通日子。',
    excerpt: '记录代码之外，正在玩的、正在练的，以及那些值得留下的普通日子。',
    mood: 'curious',
    status: 'published',
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  },
]

function slugify(title: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'daily-note'}-${Date.now().toString(36)}`
}

function excerpt(content: string) {
  return content.replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140)
}

export const repository = {
  list(status: 'draft' | 'published' | 'all' = 'published') {
    return posts.filter((post) => status === 'all' || post.status === status).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },
  get(slug: string) {
    return posts.find((post) => post.slug === slug) || null
  },
  create(input: PostInput) {
    const timestamp = new Date().toISOString()
    const post: BlogPost = { ...input, id: randomUUID(), slug: slugify(input.title), excerpt: excerpt(input.content), createdAt: timestamp, updatedAt: timestamp, publishedAt: input.status === 'published' ? timestamp : null }
    posts.unshift(post)
    return post
  },
}
