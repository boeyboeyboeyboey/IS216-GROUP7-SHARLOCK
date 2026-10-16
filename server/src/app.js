import { randomUUID } from 'node:crypto'
import express from 'express'
import { createNewsRouter } from './modules/news/router.js'
import { createPhishingRouter } from './modules/games/phishing-post-mortem/router.js'
import { createSocialEngineeringRouter } from './modules/games/social-engineering-simulator/router.js'
import { createCliDefenderRouter } from './modules/games/cli-cyber-defender/router.js'
import { createClearanceRouter } from './modules/games/clearance-tower/router.js'
import { createHealthRouter } from './routes/health.js'
import { handleError, notFound } from './middleware/errors.js'

export function createApp(
  database,
  { news = {}, phishing = {}, socialEngineering = {}, cliDefender = {}, clearanceTower = {} } = {},
) {
  const app = express()
  app.disable('x-powered-by')
  app.use((_request, response, next) => {
    response.locals.requestId = randomUUID()
    response.set('X-Request-ID', response.locals.requestId)
    response.set('X-Content-Type-Options', 'nosniff')
    next()
  })
  app.use(express.json({ limit: '16kb' }))
  app.use('/api', createHealthRouter(database))
  app.use('/api', createNewsRouter(database, news))
  app.use('/api', createPhishingRouter(phishing))
  app.use('/api', createSocialEngineeringRouter(socialEngineering))
  app.use('/api', createCliDefenderRouter(cliDefender))
  app.use('/api', createClearanceRouter(clearanceTower))
  app.use(notFound)
  app.use(handleError)
  return app
}
