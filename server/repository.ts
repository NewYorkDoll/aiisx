import { randomUUID } from 'node:crypto'
import type { Row } from '@libsql/client'
import type { BlogPost, PostInput } from '../shared/types'
import { database, ensureDatabaseSchema } from './database'

function mapPost(post: Row): BlogPost {
  return {
    id: String(post.id),
    slug: String(post.slug),
    title: String(post.title),
    content: String(post.content),
    excerpt: String(post.excerpt),
    mood: String(post.mood),
    status: String(post.status) as BlogPost['status'],
    createdAt: String(post.created_at),
    updatedAt: String(post.updated_at),
    publishedAt: post.published_at === null ? null : String(post.published_at),
  }
}

function slugify(title: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'daily-note'}-${Date.now().toString(36)}`
}

function excerpt(content: string) {
  return content.replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140)
}

export const repository = {
  async list(status: 'draft' | 'published' | 'all' = 'published') {
    await ensureDatabaseSchema()
    const result = status === 'all'
      ? await database.execute('SELECT * FROM journal_posts ORDER BY updated_at DESC')
      : await database.execute({ sql: 'SELECT * FROM journal_posts WHERE status = ? ORDER BY updated_at DESC', args: [status] })
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
        (id, slug, title, content, excerpt, mood, status, created_at, updated_at, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [post.id, post.slug, post.title, post.content, post.excerpt, post.mood, post.status, post.createdAt, post.updatedAt, post.publishedAt],
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
        SET title = ?, content = ?, excerpt = ?, mood = ?, status = ?, updated_at = ?, published_at = ?
        WHERE slug = ?`,
      args: [post.title, post.content, post.excerpt, post.mood, post.status, post.updatedAt, post.publishedAt, slug],
    })
    return post
  },

  async remove(slug: string) {
    await ensureDatabaseSchema()
    const result = await database.execute({ sql: 'DELETE FROM journal_posts WHERE slug = ?', args: [slug] })
    return result.rowsAffected > 0
  },
}
