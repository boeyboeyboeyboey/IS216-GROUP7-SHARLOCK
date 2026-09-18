import { EDITION_LIMIT, NewsError } from '../policy.js'
import { inlineText, parseInline, safeUrl } from '../inline.js'

const API_ORIGIN = 'https://content.guardianapis.com'
const CYBER_TAGS = [
  'technology/data-computer-security',
  'technology/hacking',
  'technology/malware',
  'technology/data-protection',
]
const MAX_BYTES = 1024 * 1024

export function guardianSearchUrl(edition, apiKey) {
  const url = new URL('/search', API_ORIGIN)
  const params = {
    'api-key': apiKey,
    'page-size': String(EDITION_LIMIT),
    'order-by': 'newest',
    'order-date': 'published',
    'use-date': 'published',
    'from-date': edition.window.from.slice(0, 10),
    'to-date': edition.window.to.slice(0, 10),
    'show-fields': 'headline,trailText,byline,bylineHtml,publication',
    type: 'article',
  }
  if (edition.section === 'cybersecurity') params.tag = CYBER_TAGS.join('|')
  else params.section = 'technology'
  url.search = new URLSearchParams(params).toString()
  return url
}

export function normalizeGuardian(payload, edition, now) {
  const response = payload?.response
  if (
    response?.status !== 'ok' ||
    !Array.isArray(response.results) ||
    response.results.length > EDITION_LIMIT
  ) {
    throw new Error('Invalid provider response')
  }
  const articles = []
  const seen = new Set()
  let partial = false
  for (const item of response.results) {
    try {
      const url = safeUrl(item.webUrl)
      const time = Date.parse(item.webPublicationDate)
      if (
        !url ||
        new URL(url).hostname !== 'www.theguardian.com' ||
        item.type !== 'article' ||
        typeof item.id !== 'string' ||
        !item.id ||
        item.id.length > 1000 ||
        !Number.isFinite(time)
      )
        throw new Error()
      if (
        time < Date.parse(edition.window.from) ||
        time >= Date.parse(edition.window.to) ||
        time > now
      )
        continue
      if (seen.has(item.id)) continue
      const title = inlineText(parseInline(item.fields?.headline ?? item.webTitle)).trim()
      if (!title || title.length > 2000) throw new Error()
      const excerpt = parseInline(item.fields?.trailText ?? '')
      const byline = parseInline(item.fields?.bylineHtml ?? item.fields?.byline ?? '')
      const copyright = typeof item.fields?.copyright === 'string' ? item.fields.copyright : ''
      if (copyright.length > 1000) throw new Error()
      articles.push({
        id: item.id,
        title,
        url,
        publishedAt: new Date(time).toISOString(),
        excerpt,
        byline,
        copyright,
      })
      seen.add(item.id)
    } catch {
      partial = true
    }
  }
  articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id))
  return { articles, partial }
}

export function createGuardianProvider({ apiKey, fetchImpl = fetch, now = Date.now }) {
  return {
    configured: Boolean(apiKey),
    async fetchEdition(edition) {
      if (!apiKey)
        throw new NewsError(
          'NEWS_NOT_CONFIGURED',
          'The newspaper is waiting for its news connection.',
          now() + 60000,
        )
      try {
        const response = await fetchImpl(guardianSearchUrl(edition, apiKey), {
          signal: AbortSignal.timeout(4500),
          redirect: 'error',
          headers: { Accept: 'application/json' },
        })
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
          throw new Error()
        if (Number(response.headers.get('content-length')) > MAX_BYTES) {
          await response.body?.cancel()
          throw new Error()
        }
        const reader = response.body.getReader()
        const chunks = []
        let length = 0
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            length += value.length
            if (length > MAX_BYTES) throw new Error()
            chunks.push(value)
          }
        } finally {
          await reader.cancel().catch(() => {})
          reader.releaseLock()
        }
        return normalizeGuardian(JSON.parse(Buffer.concat(chunks).toString('utf8')), edition, now())
      } catch {
        throw new NewsError(
          'NEWS_UPSTREAM_UNAVAILABLE',
          'The news desk could not reach the publisher. Please try again shortly.',
          now() + 60000,
        )
      }
    },
  }
}
