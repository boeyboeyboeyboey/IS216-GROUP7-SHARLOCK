import { Router } from 'express'
import { NewsError, parseNewsQuery } from './policy.js'
import { createGuardianProvider } from './providers/guardian.js'
import { createNewsService } from './service.js'
import { createNewsStore } from './store.js'

export function createNewsRouter(database, { apiKey, provider, store, now = Date.now } = {}) {
  const service = createNewsService({
    store: store || createNewsStore(database, { now }),
    provider: provider || createGuardianProvider({ apiKey, now }),
    now,
  })
  const router = Router()
  router.get('/news', async (request, response) => {
    response.set('Cache-Control', 'no-store')
    try {
      response.json(await service.get(parseNewsQuery(request.query)))
    } catch (error) {
      const safe =
        error instanceof NewsError
          ? error
          : new NewsError(
              'NEWS_UNAVAILABLE',
              'The newspaper is temporarily unavailable. Please try again shortly.',
              now() + 60000,
            )
      if (safe.retryAt)
        response.set('Retry-After', String(Math.max(1, Math.ceil((safe.retryAt - now()) / 1000))))
      response.status(safe.status).json({
        error: { code: safe.code, message: safe.message },
        ...(safe.retryAt && { refreshAvailableAt: new Date(safe.retryAt).toISOString() }),
        requestId: response.locals.requestId,
      })
    }
  })
  return router
}
