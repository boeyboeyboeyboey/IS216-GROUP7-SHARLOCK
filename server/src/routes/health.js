import { Router } from 'express'

export function createHealthRouter(database) {
  const router = Router()
  router.get('/health', async (_request, response) => {
    response.set('Cache-Control', 'no-store')
    try {
      if (database.readyState !== 1) throw new Error()
      await database.db.admin().command({ ping: 1 }, { maxTimeMS: 1000 })
      response.json({ status: 'ok', database: 'connected' })
    } catch {
      response.status(503).json({ status: 'unavailable', database: 'unavailable' })
    }
  })
  return router
}
