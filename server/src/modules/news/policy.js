export const NEWS_VERSION = 1
export const EDITION_LIMIT = 50
export const FRESH_MS = 30 * 60 * 1000
export const LIFETIME_MS = 23 * 60 * 60 * 1000
export const COOLDOWN_MS = 60 * 1000
export const TIMEZONE = 'Asia/Singapore'

export class NewsError extends Error {
  constructor(code, message, retryAt, status = 503) {
    super(message)
    this.code = code
    this.retryAt = retryAt
    this.status = status
  }
}

export function parseNewsQuery(query) {
  if (Object.keys(query).some((key) => !['section', 'range'].includes(key))) {
    throw new NewsError(
      'INVALID_NEWS_QUERY',
      'Choose a supported section and date range.',
      null,
      400,
    )
  }
  const section = query.section ?? 'cybersecurity'
  const range = query.range ?? 'week'
  if (!['cybersecurity', 'technology'].includes(section) || !['week', 'month'].includes(range)) {
    throw new NewsError(
      'INVALID_NEWS_QUERY',
      'Choose a supported section and date range.',
      null,
      400,
    )
  }
  return { section, range }
}

export function editionWindow(section, range, now) {
  // shift to singapore before selecting calendar days, then convert midnight back to utc
  const dateKey = new Date(now + 8 * 3600000).toISOString().slice(0, 10)
  const midnight = Date.parse(`${dateKey}T00:00:00+08:00`)
  const from = midnight - (range === 'week' ? 6 : 29) * 86400000
  const to = midnight + 86400000
  return {
    cacheKey: `${NEWS_VERSION}:${section}:${range}:${dateKey}`,
    version: NEWS_VERSION,
    section,
    range,
    dateKey,
    window: { from: new Date(from).toISOString(), to: new Date(to).toISOString() },
  }
}
