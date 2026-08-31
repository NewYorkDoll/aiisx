import { useEffect, useState } from 'react'

type CacheEntry<T> = {
  data?: T
  cachedAt: number
  promise?: Promise<T>
}

type ResourceOptions = {
  maxAge?: number
  persist?: boolean
  staleTime?: number
}

const memory = new Map<string, CacheEntry<unknown>>()
const storagePrefix = 'aiisx:resource:'

function readStorage<T>(key: string, maxAge: number) {
  try {
    const value = window.sessionStorage.getItem(`${storagePrefix}${key}`)
    if (!value) return null
    const entry = JSON.parse(value) as CacheEntry<T>
    if (!entry.cachedAt || Date.now() - entry.cachedAt > maxAge) {
      window.sessionStorage.removeItem(`${storagePrefix}${key}`)
      return null
    }
    return entry
  } catch {
    return null
  }
}

function readCache<T>(key: string, persist: boolean, maxAge: number) {
  const cached = memory.get(key) as CacheEntry<T> | undefined
  if (cached?.data !== undefined && Date.now() - cached.cachedAt <= maxAge) return cached
  if (!persist) return cached || null
  const stored = readStorage<T>(key, maxAge)
  if (stored) memory.set(key, stored)
  return stored || cached || null
}

function store<T>(key: string, data: T, persist: boolean) {
  const entry: CacheEntry<T> = { data, cachedAt: Date.now() }
  memory.set(key, entry)
  if (!persist) return
  try {
    window.sessionStorage.setItem(`${storagePrefix}${key}`, JSON.stringify(entry))
  } catch {
    // Memory caching still works when storage is unavailable or full.
  }
}

export function useResource<T>(key: string, loader: () => Promise<T>, options: ResourceOptions = {}) {
  const maxAge = options.maxAge ?? 30 * 60_000
  const persist = options.persist ?? true
  const staleTime = options.staleTime ?? 60_000
  const initial = readCache<T>(key, persist, maxAge)
  const [data, setData] = useState<T | null>(() => initial?.data ?? null)
  const [loading, setLoading] = useState(() => initial?.data === undefined)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let active = true
    const cached = readCache<T>(key, persist, maxAge)
    if (cached?.data !== undefined) {
      queueMicrotask(() => {
        if (active) { setData(cached.data as T); setLoading(false) }
      })
      if (Date.now() - cached.cachedAt <= staleTime) return () => { active = false }
    }

    queueMicrotask(() => {
      if (active) setRefreshing(cached?.data !== undefined)
    })
    const existing = memory.get(key) as CacheEntry<T> | undefined
    const request = existing?.promise || loader()
    memory.set(key, { ...existing, cachedAt: existing?.cachedAt || 0, promise: request })

    request
      .then((next) => {
        store(key, next, persist)
        if (active) { setData(next); setError(null) }
      })
      .catch((reason: unknown) => {
        const current = memory.get(key) as CacheEntry<T> | undefined
        if (current?.promise === request) memory.set(key, { ...current, promise: undefined })
        if (active) setError(reason instanceof Error ? reason : new Error('Unable to load resource'))
      })
      .finally(() => {
        if (active) { setLoading(false); setRefreshing(false) }
      })

    return () => { active = false }
  }, [key, loader, maxAge, persist, staleTime])

  return { data, error, loading, refreshing }
}
