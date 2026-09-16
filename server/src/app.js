import { randomUUID } from 'node:crypto'
import express from 'express'
import { createHealthRouter } from './routes/health.js'
import { handleError, notFound } from './middleware/errors.js'

export function createApp(database) {
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
  app.use(notFound)
  app.use(handleError)
  return app
}
