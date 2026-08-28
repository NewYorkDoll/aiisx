import { randomUUID } from 'node:crypto'
import { drizzle } from 'drizzle-orm/mysql2'
import { mysqlTable, varchar, text, datetime } from 'drizzle-orm/mysql-core'
import { desc, eq } from 'drizzle-orm'
import mysql from 'mysql2/promise'
import type { BlogPost, PostInput } from '../shared/types'

const journalPosts = mysqlTable('journal_posts', {
  id: varchar('id', { length: 36 }).primaryKey(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  title: varchar('title', { length: 120 }).notNull(),
  content: text('content').notNull(),
  excerpt: varchar('excerpt', { length: 180 }).notNull(),
  mood: varchar('mood', { length: 32 }).notNull(),
  status: varchar('status', { length: 16 }).notNull(),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
  publishedAt: datetime('published_at'),
})

const now = new Date()
const memoryPosts: BlogPost[] = [{ id: 'welcome', slug: 'keep-the-shell', title: '把博客重新装回自己的 Shell', content: '这是一个新的开始。\n\n我想记录代码之外，正在玩的、正在练的，以及那些值得留下的普通日子。', excerpt: '记录代码之外，正在玩的、正在练的，以及那些值得留下的普通日子。', mood: 'curious', status: 'published', createdAt: now.toISOString(), updatedAt: now.toISOString(), publishedAt: now.toISOString() }]
const pool = process.env.DATABASE_URL ? mysql.createPool(process.env.DATABASE_URL) : null
const db = pool ? drizzle(pool) : null
let schemaReady: Promise<void> | null = null

async function ensureSchema() {
  if (!pool || !db) return
  if (!schemaReady) schemaReady = pool.query('CREATE TABLE IF NOT EXISTS journal_posts (id VARCHAR(36) PRIMARY KEY, slug VARCHAR(120) NOT NULL UNIQUE, title VARCHAR(120) NOT NULL, content TEXT NOT NULL, excerpt VARCHAR(180) NOT NULL, mood VARCHAR(32) NOT NULL, status VARCHAR(16) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, published_at DATETIME NULL)') .then(() => undefined)
  await schemaReady
}

function mapPost(post: typeof journalPosts.$inferSelect): BlogPost {
  return { id: post.id, slug: post.slug, title: post.title, content: post.content, excerpt: post.excerpt, mood: post.mood, status: post.status as BlogPost['status'], createdAt: post.createdAt.toISOString(), updatedAt: post.updatedAt.toISOString(), publishedAt: post.publishedAt?.toISOString() || null }
}

function slugify(title: string) { return `${title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'daily-note'}-${Date.now().toString(36)}` }
function excerpt(content: string) { return content.replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140) }

export const repository = {
  async list(status: 'draft' | 'published' | 'all' = 'published') {
    await ensureSchema()
    if (db) {
      const rows = await db.select().from(journalPosts).orderBy(desc(journalPosts.updatedAt))
      return rows.filter((post) => status === 'all' || post.status === status).map(mapPost)
    }
    return memoryPosts.filter((post) => status === 'all' || post.status === status).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },
  async get(slug: string) {
    await ensureSchema()
    if (db) { const rows = await db.select().from(journalPosts).where(eq(journalPosts.slug, slug)).limit(1); return rows[0] ? mapPost(rows[0]) : null }
    return memoryPosts.find((post) => post.slug === slug) || null
  },
  async create(input: PostInput) {
    const timestamp = new Date()
    const post: BlogPost = { ...input, id: randomUUID(), slug: slugify(input.title), excerpt: excerpt(input.content), createdAt: timestamp.toISOString(), updatedAt: timestamp.toISOString(), publishedAt: input.status === 'published' ? timestamp.toISOString() : null }
    await ensureSchema()
    if (db) {
      await db.insert(journalPosts).values({ ...post, content: post.content, createdAt: timestamp, updatedAt: timestamp, publishedAt: post.publishedAt ? timestamp : null })
      return post
    }
    memoryPosts.unshift(post)
    return post
  },
}
