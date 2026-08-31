import { randomUUID } from 'node:crypto'
import type { Row } from '@libsql/client'
import type { BlogPost, PostInput } from '../shared/types.js'
import { database, ensureDatabaseSchema } from './database.js'

function mapPost(post: Row): BlogPost {
  return {
    id: String(post.id),
    slug: String(post.slug),
    title: String(post.title),
    content: String(post.content),
    excerpt: String(post.excerpt),
    mood: String(post.mood),
    tags: parseTags(post.tags),
    status: String(post.status) as BlogPost['status'],
    createdAt: String(post.created_at),
    updatedAt: String(post.updated_at),
    publishedAt: post.published_at === null ? null : String(post.published_at),
  }
}

function parseTags(value: Row[string]) {
  if (typeof value !== 'string') return []
  try {
    const tags = JSON.parse(value) as unknown
    return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : []
  } catch {
    return []
  }
}

function slugify(title: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'daily-note'}-${Date.now().toString(36)}`
}

function excerpt(content: string) {
  return content.replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140)
}

export const repository = {
  async list(status: 'draft' | 'published' | 'all' = 'published', filters: { query?: string; tag?: string } = {}) {
    await ensureDatabaseSchema()
    const conditions: string[] = []
    const args: Array<string> = []
    if (status !== 'all') {
      conditions.push('status = ?')
      args.push(status)
    }
    const query = filters.query?.trim().toLowerCase()
    if (query) {
      conditions.push("(LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(mood) LIKE ? OR LOWER(tags) LIKE ?)")
      const pattern = `%${query}%`
      args.push(pattern, pattern, pattern, pattern)
    }
    const tag = filters.tag?.trim().toLowerCase()
    if (tag) {
      conditions.push('LOWER(tags) LIKE ?')
      args.push(`%${JSON.stringify(tag)}%`)
    }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
    const result = await database.execute({ sql: `SELECT * FROM journal_posts${where} ORDER BY updated_at DESC`, args })
    return result.rows.map(mapPost)
  },

  async get(slug: string) {
    await ensureDatabaseSchema()
    const result = await database.execute({ sql: 'SELECT * FROM journal_posts WHERE slug = ? LIMIT 1', args: [slug] })
    return result.rows[0] ? mapPost(result.rows[0]) : null
  },

  async create(input: PostInput) {
    await ensureDatabaseSchema()
    const timestamp = new Date().toISOString()
    const post: BlogPost = {
      ...input,
      id: randomUUID(),
      slug: slugify(input.title),
      excerpt: excerpt(input.content),
      createdAt: timestamp,
      updatedAt: timestamp,
      publishedAt: input.status === 'published' ? timestamp : null,
    }
    await database.execute({
      sql: `INSERT INTO journal_posts
        (id, slug, title, content, excerpt, mood, tags, status, created_at, updated_at, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [post.id, post.slug, post.title, post.content, post.excerpt, post.mood, JSON.stringify(post.tags), post.status, post.createdAt, post.updatedAt, post.publishedAt],
    })
    return post
  },

  async update(slug: string, input: PostInput) {
    const existing = await repository.get(slug)
    if (!existing) return null

    const timestamp = new Date().toISOString()
    const post: BlogPost = {
      ...existing,
      ...input,
      excerpt: excerpt(input.content),
      updatedAt: timestamp,
      publishedAt: input.status === 'published' ? existing.publishedAt || timestamp : null,
    }
    await database.execute({
      sql: `UPDATE journal_posts
        SET title = ?, content = ?, excerpt = ?, mood = ?, tags = ?, status = ?, updated_at = ?, published_at = ?
        WHERE slug = ?`,
      args: [post.title, post.content, post.excerpt, post.mood, JSON.stringify(post.tags), post.status, post.updatedAt, post.publishedAt, slug],
    })
    return post
  },

  async remove(slug: string) {
    await ensureDatabaseSchema()
    const result = await database.execute({ sql: 'DELETE FROM journal_posts WHERE slug = ?', args: [slug] })
    return result.rowsAffected > 0
  },
}
