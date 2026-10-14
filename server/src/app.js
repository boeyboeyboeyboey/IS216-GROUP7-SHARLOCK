import { randomUUID } from 'node:crypto'
import express from 'express'
import { createNewsRouter } from './modules/news/router.js'
import { createPhishingRouter } from './modules/games/phishing-post-mortem/router.js'
import { createSocialEngineeringRouter } from './modules/games/social-engineering-simulator/router.js'
import { createCliDefenderRouter } from './modules/games/cli-cyber-defender/router.js'
import { createAuthRouter } from './modules/auth/router.js'
import { createCohortRouter } from './modules/cohorts/router.js'
import { createAuditRouter } from './modules/audit/router.js'
import { createHealthRouter } from './routes/health.js'
import { handleError, notFound } from './middleware/errors.js'

export function createApp(
  database,
  { auth, audit = {}, news = {}, phishing = {}, socialEngineering = {}, cliDefender = {} } = {},
) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', false)
  app.use((_request, response, next) => {
    response.locals.requestId = randomUUID()
    response.set('X-Request-ID', response.locals.requestId)
    response.set('X-Content-Type-Options', 'nosniff')
    next()
  })
  app.use(express.json({ limit: '16kb' }))
  const authRuntime = createAuthRouter(database, auth)
  app.use('/api/auth', authRuntime.router)
  app.use('/api', createCohortRouter(database, { requireSession: authRuntime.requireSession }))
  app.use(
    '/api',
    createAuditRouter(database, { ...audit, requireSession: authRuntime.requireSession }),
  )
  app.use('/api', createHealthRouter(database))
  app.use('/api', createNewsRouter(database, news))
  app.use('/api', createPhishingRouter(phishing))
  app.use('/api', createSocialEngineeringRouter(socialEngineering))
  app.use('/api', createCliDefenderRouter(cliDefender))
  app.use(notFound)
  app.use(handleError)
  app.locals.disposeAuth = authRuntime.dispose
  return app
}
