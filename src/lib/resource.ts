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

type ResourceState<T> = {
  data: T | null
  error: Error | null
  key: string
  loading: boolean
  refreshing: boolean
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
  const [state, setState] = useState<ResourceState<T>>(() => ({
    data: initial?.data ?? null,
    error: null,
    key,
    loading: initial?.data === undefined,
    refreshing: false,
  }))
  const view = state.key === key ? state : {
    data: initial?.data ?? null,
    error: null,
    key,
    loading: initial?.data === undefined,
    refreshing: false,
  }

  useEffect(() => {
    let active = true
    const cached = readCache<T>(key, persist, maxAge)
    if (cached?.data !== undefined) {
      queueMicrotask(() => {
        if (active) setState({ data: cached.data as T, error: null, key, loading: false, refreshing: false })
      })
      if (Date.now() - cached.cachedAt <= staleTime) return () => { active = false }
    }

    queueMicrotask(() => {
      if (active) setState({ data: cached?.data ?? null, error: null, key, loading: cached?.data === undefined, refreshing: cached?.data !== undefined })
    })
    const existing = memory.get(key) as CacheEntry<T> | undefined
    const request = existing?.promise || loader()
    memory.set(key, { ...existing, cachedAt: existing?.cachedAt || 0, promise: request })

    request
      .then((next) => {
        store(key, next, persist)
        if (active) setState({ data: next, error: null, key, loading: false, refreshing: false })
      })
      .catch((reason: unknown) => {
        const current = memory.get(key) as CacheEntry<T> | undefined
        if (current?.promise === request) memory.set(key, { ...current, promise: undefined })
        if (active) setState({
          data: cached?.data ?? null,
          error: reason instanceof Error ? reason : new Error('Unable to load resource'),
          key,
          loading: false,
          refreshing: false,
        })
      })

    return () => { active = false }
  }, [key, loader, maxAge, persist, staleTime])

  return { data: view.data, error: view.error, loading: view.loading, refreshing: view.refreshing }
}
