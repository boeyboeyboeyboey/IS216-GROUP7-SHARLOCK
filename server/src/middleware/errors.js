export function notFound(_request, response) {
  response.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Endpoint not found.' },
    requestId: response.locals.requestId,
  })
}

// express requires four parameters to route errors to this handler
// eslint-disable-next-line no-unused-vars
export function handleError(error, _request, response, _next) {
  const malformedJson = error.type === 'entity.parse.failed'
  const tooLarge = error.type === 'entity.too.large'
  const status = malformedJson ? 400 : tooLarge ? 413 : 500
  if (status === 500) {
    // log only the request id so internal errors cannot expose secrets
    console.error(JSON.stringify({ event: 'request_failed', requestId: response.locals.requestId }))
  }
  response.status(status).json({
    error: {
      code: malformedJson ? 'INVALID_JSON' : tooLarge ? 'BODY_TOO_LARGE' : 'INTERNAL_ERROR',
      message: malformedJson
        ? 'Request body must be valid JSON.'
        : tooLarge
          ? 'Request body is too large.'
          : 'Request could not be completed.',
    },
    requestId: response.locals.requestId,
  })
}
