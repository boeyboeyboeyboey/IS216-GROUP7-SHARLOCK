import { Router } from 'express'
import { parseEmptyQuery } from '../auth/policy.js'
import { ActivationError } from './policy.js'
import { createRecoveryService } from './service.js'

export function createActivationRouter(database, { requireMutation, ...settings }) {
  const service = createRecoveryService(database, settings)
  const router = Router()
  router.post('/activate-account', ...requireMutation, async (request, response, next) => {
    try {
      parseEmptyQuery(request.query)
      await service.activateAccount(request.body)
      response.status(204).end()
    } catch (error) {
      next(error)
    }
  })
  router.use((error, _request, response, next) => {
    if (!(error instanceof ActivationError)) {
      next(error)
      return
    }
    response.status(error.status).json({
      error: { code: error.code, message: error.message },
      requestId: response.locals.requestId,
    })
  })
  return router
}
