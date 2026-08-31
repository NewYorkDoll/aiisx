import { useEffect } from 'react'

type PageMeta = {
  title: string
  description: string
  path?: string
  type?: 'website' | 'article'
}

const origin = 'https://aiisx.com'

function upsertMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.content = content
}

export function usePageMeta({ title, description, path = '/', type = 'website' }: PageMeta) {
  useEffect(() => {
    const fullTitle = `${title} / aiisx`
    const canonicalUrl = new URL(path, origin).toString()
    document.title = fullTitle
    upsertMeta('meta[name="description"]', 'name', 'description', description)
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle)
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description)
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', type)
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl)
    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary')
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.append(canonical)
    }
    canonical.href = canonicalUrl
  }, [description, path, title, type])
}
