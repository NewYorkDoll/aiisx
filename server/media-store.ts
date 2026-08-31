import { randomUUID } from 'node:crypto'
import type { Row } from '@libsql/client'
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { MediaAsset } from '../shared/types.js'
import { database, ensureDatabaseSchema } from './database.js'

const imageLimit = 25 * 1024 * 1024
const videoLimit = 500 * 1024 * 1024
const allowedTypes = new Map([
  ['image/jpeg', { kind: 'image' as const, extension: 'jpg' }],
  ['image/png', { kind: 'image' as const, extension: 'png' }],
  ['image/webp', { kind: 'image' as const, extension: 'webp' }],
  ['image/gif', { kind: 'image' as const, extension: 'gif' }],
  ['image/avif', { kind: 'image' as const, extension: 'avif' }],
  ['video/mp4', { kind: 'video' as const, extension: 'mp4' }],
  ['video/webm', { kind: 'video' as const, extension: 'webm' }],
])

type R2Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicUrl: string
}

function r2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  const bucket = process.env.R2_BUCKET?.trim()
  const publicUrl = process.env.R2_PUBLIC_URL?.trim().replace(/\/$/, '')
  return accountId && accessKeyId && secretAccessKey && bucket && publicUrl
    ? { accountId, accessKeyId, secretAccessKey, bucket, publicUrl }
    : null
}

function client(config: R2Config) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  })
}

function mapAsset(row: Row): MediaAsset {
  return {
    id: String(row.id),
    key: String(row.object_key),
    kind: String(row.kind) as MediaAsset['kind'],
    contentType: String(row.content_type),
    originalName: String(row.original_name),
    size: Number(row.size_bytes),
    url: String(row.public_url),
    status: String(row.status) as MediaAsset['status'],
    width: row.width === null ? null : Number(row.width),
    height: row.height === null ? null : Number(row.height),
    duration: row.duration_seconds === null ? null : Number(row.duration_seconds),
    posterUrl: row.poster_url === null ? null : String(row.poster_url),
    createdAt: String(row.created_at),
    completedAt: row.completed_at === null ? null : String(row.completed_at),
  }
}

function publicObjectUrl(config: R2Config, key: string) {
  return `${config.publicUrl}/${key.split('/').map(encodeURIComponent).join('/')}`
}

export const mediaLimits = { image: imageLimit, video: videoLimit }

export function mediaConfiguration() {
  return { configured: Boolean(r2Config()), limits: mediaLimits, types: [...allowedTypes.keys()] }
}

export async function createMediaUpload(input: { filename: string; contentType: string; size: number }) {
  const config = r2Config()
  if (!config) throw new Error('Media storage is not configured')
  const mediaType = allowedTypes.get(input.contentType.toLowerCase())
  if (!mediaType) throw new Error('Unsupported media type')
  const limit = mediaType.kind === 'image' ? imageLimit : videoLimit
  if (input.size > limit) throw new Error(`${mediaType.kind === 'image' ? 'Image' : 'Video'} exceeds the upload limit`)

  const now = new Date()
  const id = randomUUID()
  const key = `${mediaType.kind}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${id}.${mediaType.extension}`
  const asset: MediaAsset = {
    id,
    key,
    kind: mediaType.kind,
    contentType: input.contentType.toLowerCase(),
    originalName: input.filename,
    size: input.size,
    url: publicObjectUrl(config, key),
    status: 'pending',
    width: null,
    height: null,
    duration: null,
    posterUrl: null,
    createdAt: now.toISOString(),
    completedAt: null,
  }
  await ensureDatabaseSchema()
  await database.execute({
    sql: `INSERT INTO media_assets
      (id, object_key, kind, content_type, original_name, size_bytes, public_url, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    args: [asset.id, asset.key, asset.kind, asset.contentType, asset.originalName, asset.size, asset.url, asset.createdAt],
  })
  const uploadUrl = await getSignedUrl(client(config), new PutObjectCommand({
    Bucket: config.bucket,
    Key: asset.key,
    ContentType: asset.contentType,
  }), { expiresIn: 10 * 60 })
  return { asset, uploadUrl, expiresIn: 10 * 60 }
}

export async function completeMediaUpload(id: string, metadata: { width?: number | null; height?: number | null; duration?: number | null; posterUrl?: string | null }) {
  const config = r2Config()
  if (!config) throw new Error('Media storage is not configured')
  await ensureDatabaseSchema()
  const result = await database.execute({ sql: 'SELECT * FROM media_assets WHERE id = ? LIMIT 1', args: [id] })
  if (!result.rows[0]) return null
  const asset = mapAsset(result.rows[0])
  if (asset.status !== 'pending') return asset

  try {
    const object = await client(config).send(new HeadObjectCommand({ Bucket: config.bucket, Key: asset.key }))
    const uploadedSize = Number(object.ContentLength || 0)
    const uploadedType = object.ContentType?.split(';')[0]?.toLowerCase()
    if (uploadedSize !== asset.size || uploadedType !== asset.contentType) throw new Error('Uploaded object does not match its signed metadata')
  } catch (error) {
    await database.execute({ sql: "UPDATE media_assets SET status = 'failed' WHERE id = ?", args: [id] })
    throw error
  }

  const completedAt = new Date().toISOString()
  await database.execute({
    sql: `UPDATE media_assets SET status = 'ready', width = ?, height = ?, duration_seconds = ?, poster_url = ?, completed_at = ? WHERE id = ?`,
    args: [metadata.width ?? null, metadata.height ?? null, metadata.duration ?? null, metadata.posterUrl ?? null, completedAt, id],
  })
  return { ...asset, ...metadata, status: 'ready' as const, completedAt }
}

export async function listMediaAssets(limit = 60) {
  await ensureDatabaseSchema()
  const result = await database.execute({
    sql: `SELECT * FROM media_assets WHERE status != 'deleted' ORDER BY created_at DESC LIMIT ?`,
    args: [Math.min(Math.max(limit, 1), 100)],
  })
  return result.rows.map(mapAsset)
}

export async function getMediaAsset(id: string) {
  await ensureDatabaseSchema()
  const result = await database.execute({ sql: 'SELECT * FROM media_assets WHERE id = ? LIMIT 1', args: [id] })
  return result.rows[0] ? mapAsset(result.rows[0]) : null
}

export async function deleteMediaAsset(id: string) {
  const config = r2Config()
  if (!config) throw new Error('Media storage is not configured')
  await ensureDatabaseSchema()
  const result = await database.execute({ sql: 'SELECT * FROM media_assets WHERE id = ? LIMIT 1', args: [id] })
  if (!result.rows[0]) return false
  const asset = mapAsset(result.rows[0])
  await client(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: asset.key }))
  await database.execute({ sql: "UPDATE media_assets SET status = 'deleted' WHERE id = ?", args: [id] })
  return true
}
