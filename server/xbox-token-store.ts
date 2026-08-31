import 'dotenv/config'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { TokenStore } from 'xal-node'
import { database, ensureDatabaseSchema } from './database.js'

const legacyTokenFile = process.env.XBOX_TOKEN_FILE || '.xbox.tokens.json'

function encryptionKey() {
  const secret = process.env.XBOX_TOKEN_ENCRYPTION_KEY?.trim() || process.env.ADMIN_TOKEN?.trim()
  if (!secret) throw new Error('Set XBOX_TOKEN_ENCRYPTION_KEY or ADMIN_TOKEN before storing Xbox credentials')
  return createHash('sha256').update(secret).digest()
}

function encrypt(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`
}

function decrypt(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split('.')
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) throw new Error('Unsupported Xbox credential format')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8')
}

function serialize(store: TokenStore) {
  return JSON.stringify({
    userToken: store._userToken?.data,
    sisuToken: store._sisuToken?.data,
    jwtKeys: store._jwtKeys,
  })
}

export async function saveXboxTokenStore(store: TokenStore) {
  const value = serialize(store)
  if (!store.getUserToken()) return
  await ensureDatabaseSchema()
  await database.execute({
    sql: `INSERT INTO xbox_auth (id, encrypted_tokens, updated_at)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        encrypted_tokens = excluded.encrypted_tokens,
        updated_at = excluded.updated_at`,
    args: [encrypt(value), new Date().toISOString()],
  })
}

export async function loadXboxTokenStore() {
  await ensureDatabaseSchema()
  const store = new TokenStore()
  store.save = () => undefined
  store.removeAll = () => {
    store._userToken = undefined
    store._sisuToken = undefined
  }

  const result = await database.execute('SELECT encrypted_tokens FROM xbox_auth WHERE id = 1 LIMIT 1')
  const stored = result.rows[0]?.encrypted_tokens
  if (stored) {
    store.loadJson(decrypt(String(stored)))
    return store
  }

  const legacy = new TokenStore()
  if (legacy.load(legacyTokenFile, true) && legacy.getUserToken()) {
    store.loadJson(serialize(legacy))
    await saveXboxTokenStore(store)
  }
  return store
}
