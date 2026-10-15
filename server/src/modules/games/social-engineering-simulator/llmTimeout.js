// slow local models need a longer deadline than the default fetch gives them
export function withTimeout(fetchImpl, timeoutMs) {
  return (url, init = {}) => fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
}
