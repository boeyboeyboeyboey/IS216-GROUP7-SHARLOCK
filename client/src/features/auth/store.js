import { defineStore } from 'pinia'
import { ref } from 'vue'
import { parseLoginInput, parseRegistrationInput } from './validation.js'
import {
  requestCsrfToken,
  requestCurrentUser,
  requestLogin,
  requestLogout,
  requestRegistration,
  SafeAuthError,
  toSafeAuthError,
} from './api.js'

function isAuthenticationRequired(error) {
  return error.status === 401 && error.code === 'AUTHENTICATION_REQUIRED'
}

function userDto(value) {
  if (!value || typeof value !== 'object') {
    throw new SafeAuthError({ message: 'Sharlock returned an incomplete account. Try again.' })
  }

  const { id, email, username, avatarId, globalRoles } = value
  if (
    typeof id !== 'string' ||
    typeof email !== 'string' ||
    typeof username !== 'string' ||
    typeof avatarId !== 'string' ||
    !Array.isArray(globalRoles)
  ) {
    throw new SafeAuthError({ message: 'Sharlock returned an incomplete account. Try again.' })
  }

  return Object.freeze({ id, email, username, avatarId, globalRoles: [...globalRoles] })
}

export const useAuthStore = defineStore('auth', () => {
  const status = ref('unknown')
  const user = ref(null)
  const csrfToken = ref(null)
  const requestError = ref(null)
  const logoutPending = ref(false)

  let generation = 0
  let restoreRequest = null
  let csrfRequest = null
  let mutationPending = false

  function isCurrent(operation) {
    return generation === operation && !logoutPending.value
  }

  function accountActionBusy() {
    return new SafeAuthError({
      code: 'ACCOUNT_ACTION_PENDING',
      status: 409,
      message: 'Please wait for the current account request to finish.',
    })
  }

  function settledRestoreResult() {
    if (logoutPending.value || mutationPending) throw accountActionBusy()
    return status.value === 'authenticated' && user.value ? user.value : null
  }

  function clearIdentity(nextStatus = 'anonymous') {
    user.value = null
    csrfToken.value = null
    status.value = nextStatus
  }

  function beginMutation() {
    if (logoutPending.value || mutationPending) {
      throw new SafeAuthError({ message: 'Please wait for the current account request to finish.' })
    }
    mutationPending = true
    const operation = ++generation
    requestError.value = null
    restoreRequest = null
    return operation
  }

  async function getCsrf(operation, { force = false } = {}) {
    if (!force && csrfToken.value) return csrfToken.value
    if (csrfRequest?.generation === operation) return csrfRequest.promise

    const request = { generation: operation }
    request.promise = requestCsrfToken()
      .then((token) => {
        if (generation === operation) csrfToken.value = token
        return token
      })
      .finally(() => {
        if (csrfRequest === request) csrfRequest = null
      })
    csrfRequest = request
    return request.promise
  }

  async function refreshCsrfAfterRejection(operation) {
    try {
      await getCsrf(operation, { force: true })
    } catch {
      // preserve the original safe mutation error for the form
    }
  }

  function storeMutationError(error, operation) {
    const safeError = toSafeAuthError(error)
    if (!isCurrent(operation)) return safeError
    requestError.value = safeError
    return safeError
  }

  function validate(parser, value) {
    try {
      return parser(value)
    } catch (error) {
      const safeError = toSafeAuthError(error)
      requestError.value = safeError
      throw safeError
    }
  }

  async function restoreSession({ force = false } = {}) {
    if (logoutPending.value || mutationPending) throw accountActionBusy()
    if (!force && status.value === 'authenticated' && user.value) return user.value
    if (restoreRequest?.generation === generation) return restoreRequest.promise

    const operation = generation
    const hadIdentity = status.value === 'authenticated' && Boolean(user.value)
    if (!hadIdentity) status.value = 'loading'
    requestError.value = null

    const request = { generation: operation }
    request.promise = (async () => {
      let accountVerified = false
      try {
        const restoredUser = userDto(await requestCurrentUser())
        if (!isCurrent(operation)) return settledRestoreResult()
        user.value = restoredUser
        status.value = 'authenticated'
        accountVerified = true
        await getCsrf(operation)
        return isCurrent(operation) ? user.value : settledRestoreResult()
      } catch (error) {
        const safeError = toSafeAuthError(error)
        if (!isCurrent(operation)) return settledRestoreResult()
        if (isAuthenticationRequired(safeError)) {
          clearIdentity('anonymous')
          requestError.value = null
          return null
        }
        requestError.value = safeError
        if (!hadIdentity && !accountVerified) status.value = 'unknown'
        throw safeError
      } finally {
        if (restoreRequest === request) restoreRequest = null
      }
    })()
    restoreRequest = request
    return request.promise
  }

  async function authenticate(kind, payload) {
    const operation = beginMutation()
    try {
      const token = await getCsrf(operation)
      const response =
        kind === 'register'
          ? await requestRegistration(payload, token)
          : await requestLogin(payload, token)
      const authenticatedUser = userDto(response?.user)
      if (!isCurrent(operation)) return null
      if (typeof response.csrfToken !== 'string' || !response.csrfToken) {
        throw new SafeAuthError({ message: 'Sign-in could not be completed. Please try again.' })
      }
      user.value = authenticatedUser
      csrfToken.value = response.csrfToken
      status.value = 'authenticated'
      requestError.value = null
      return authenticatedUser
    } catch (error) {
      const safeError = storeMutationError(error, operation)
      if (safeError.status === 403) await refreshCsrfAfterRejection(operation)
      throw safeError
    } finally {
      mutationPending = false
    }
  }

  async function login({ email, password }) {
    const input = validate(parseLoginInput, { email, password })
    return authenticate('login', {
      email: input.emailNormalized,
      password: input.password,
    })
  }

  async function register({ email, username, password, avatarId }) {
    const input = validate(parseRegistrationInput, { email, username, password, avatarId })
    return authenticate('register', {
      email: input.emailNormalized,
      username: input.username.display,
      password: input.password,
      avatarId: input.avatarId,
    })
  }

  async function logout() {
    if (status.value !== 'authenticated' || !user.value) {
      invalidateSession()
      return
    }

    if (logoutPending.value) return
    const operation = ++generation
    logoutPending.value = true
    requestError.value = null
    restoreRequest = null

    try {
      const token = csrfToken.value || (await getCsrf(operation))
      await requestLogout(token)
      if (generation === operation) {
        clearIdentity('anonymous')
        requestError.value = null
      }
    } catch (error) {
      const safeError = toSafeAuthError(error)
      if (generation !== operation) return
      if (isAuthenticationRequired(safeError)) {
        clearIdentity('anonymous')
        requestError.value = null
        return
      }
      requestError.value = safeError
      if (safeError.status === 403) await refreshCsrfAfterRejection(operation)
      throw safeError
    } finally {
      if (generation === operation) logoutPending.value = false
    }
  }

  function invalidateSession() {
    generation += 1
    restoreRequest = null
    csrfRequest = null
    mutationPending = false
    logoutPending.value = false
    requestError.value = null
    clearIdentity('anonymous')
  }

  return {
    status,
    user,
    csrfToken,
    requestError,
    logoutPending,
    restoreSession,
    login,
    register,
    logout,
    invalidateSession,
  }
})
