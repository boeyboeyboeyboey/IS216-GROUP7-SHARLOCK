import { AxiosError, CanceledError } from 'axios'

export function createAccountGuard(auth) {
  return async (to) => {
    if (!to.meta.requiresAccount && !to.meta.accountAware && !to.meta.authPage) return true
    const previouslySignedIn = auth.status === 'authenticated'
    let user
    try {
      user = await auth.restoreSession({ force: true })
    } catch {
      return to.meta.requiresAccount ? { path: '/login', query: { reason: 'unavailable' } } : true
    }
    if (to.meta.requiresAccount && !user) {
      return {
        path: '/login',
        query: { reason: previouslySignedIn ? 'expired' : 'required' },
      }
    }
    if (to.meta.requiredRole && !user?.globalRoles?.includes(to.meta.requiredRole)) {
      return { path: '/forbidden' }
    }
    if (to.meta.authPage && user) return { name: 'town' }
    return true
  }
}

export function installBrowserAccountAccess(
  client,
  { checkSession, onExpired, getOrigin = () => window.location.origin },
) {
  const interceptor = client.interceptors.request.use(async (config) => {
    const origin = getOrigin()
    const destination = new URL(client.getUri(config), origin)
    const protectedPath = /^\/api\/(?:news(?:\/|$)|games(?:\/|$))/.test(destination.pathname)
    if (destination.origin !== origin || !protectedPath) return config
    if (config.signal?.aborted) throw new CanceledError()

    const user = await checkSession()
    if (config.signal?.aborted) throw new CanceledError()
    if (!user) {
      onExpired()
      throw new AxiosError('Sign in to continue.', 'ERR_AUTH_REQUIRED', config, undefined, {
        status: 401,
        data: { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' } },
      })
    }
    return config
  })
  return () => client.interceptors.request.eject(interceptor)
}
