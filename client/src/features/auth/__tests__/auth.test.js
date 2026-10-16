import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAuthStore } from '../store.js'
import LoginForm from '../components/LoginForm.vue'
import RegisterForm from '../components/RegisterForm.vue'
import AvatarPicker from '../components/AvatarPicker.vue'
import AccountSummary from '../components/AccountSummary.vue'
import LoginPage from '../pages/LoginPage.vue'
import RegisterPage from '../pages/RegisterPage.vue'

const authRequests = vi.hoisted(() => ({
  requestCsrfToken: vi.fn(),
  requestCurrentUser: vi.fn(),
  requestLogin: vi.fn(),
  requestLogout: vi.fn(),
  requestRegistration: vi.fn(),
}))

vi.mock('../api.js', async () => {
  const actual = await vi.importActual('../api.js')
  return { ...actual, ...authRequests }
})

const account = Object.freeze({
  id: '66f0a35f2d84787cce1a1001',
  email: 'detective@example.test',
  username: 'Case_Finder',
  avatarId: 'blue',
  globalRoles: ['student'],
  passwordHash: 'private-value',
  authVersion: 22,
})

function rejectedAuth(code, status, message = 'private backend detail') {
  return Object.assign(new Error(message), {
    response: { status, data: { error: { code, message } }, headers: {} },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('auth store', () => {
  it('deduplicates forced restoration and keeps only the public user DTO', async () => {
    let resolveCurrentUser
    authRequests.requestCurrentUser.mockReturnValue(
      new Promise((resolve) => {
        resolveCurrentUser = resolve
      }),
    )
    authRequests.requestCsrfToken.mockResolvedValue('memory-only-token')
    const auth = useAuthStore()

    const first = auth.restoreSession({ force: true })
    const second = auth.restoreSession({ force: true })
    expect(auth.status).toBe('loading')
    expect(authRequests.requestCurrentUser).toHaveBeenCalledTimes(1)
    resolveCurrentUser(account)

    const restored = await Promise.all([first, second])
    expect(restored[0]).toEqual({
      id: account.id,
      email: account.email,
      username: account.username,
      avatarId: account.avatarId,
      globalRoles: ['student'],
    })
    expect(restored[1]).toEqual(restored[0])
    expect(auth.user).toEqual(restored[0])
    expect(auth.csrfToken).toBe('memory-only-token')
    expect(authRequests.requestCsrfToken).toHaveBeenCalledTimes(1)
    expect(auth.user).not.toHaveProperty('passwordHash')
    expect(auth.user).not.toHaveProperty('authVersion')
  })

  it('keeps the current identity visible during a forced session check', async () => {
    authRequests.requestCsrfToken.mockResolvedValue('anonymous-token')
    authRequests.requestRegistration.mockResolvedValue({
      user: account,
      csrfToken: 'signed-in-token',
    })
    let resolveCurrentUser
    authRequests.requestCurrentUser.mockReturnValue(
      new Promise((resolve) => {
        resolveCurrentUser = resolve
      }),
    )
    const auth = useAuthStore()
    await auth.register({
      email: account.email,
      username: account.username,
      password: 'Correct-Horse-🔒-2026',
      avatarId: account.avatarId,
    })

    const restoring = auth.restoreSession({ force: true })
    expect(auth.status).toBe('authenticated')
    expect(auth.user.username).toBe(account.username)
    resolveCurrentUser(account)
    await expect(restoring).resolves.toMatchObject({ username: account.username })
  })

  it('sends only the four approved registration fields and stores automatic sign-in', async () => {
    authRequests.requestCsrfToken.mockResolvedValue('anonymous-token')
    authRequests.requestRegistration.mockResolvedValue({
      user: { ...account, passwordHash: 'must-not-be-kept' },
      csrfToken: 'rotated-token',
    })
    const auth = useAuthStore()

    await auth.register({
      email: ' Detective@Example.test ',
      username: ' Case_Finder ',
      password: 'Correct-Horse-🔒-2026',
      avatarId: 'detective',
      passwordConfirmation: 'must never reach the API',
    })

    expect(authRequests.requestRegistration).toHaveBeenCalledWith(
      {
        email: 'detective@example.test',
        username: 'Case_Finder',
        password: 'Correct-Horse-🔒-2026',
        avatarId: 'detective',
      },
      'anonymous-token',
    )
    expect(Object.keys(authRequests.requestRegistration.mock.calls[0][0])).toEqual([
      'email',
      'username',
      'password',
      'avatarId',
    ])
    expect(auth.status).toBe('authenticated')
    expect(auth.csrfToken).toBe('rotated-token')
    expect(auth.user).not.toHaveProperty('passwordHash')
  })

  it('refreshes a rejected CSRF token without replaying the sign-in POST', async () => {
    authRequests.requestCsrfToken
      .mockResolvedValueOnce('stale-token')
      .mockResolvedValueOnce('fresh-token')
    authRequests.requestLogin.mockRejectedValue(rejectedAuth('CSRF_INVALID', 403))
    const auth = useAuthStore()

    await expect(
      auth.login({ email: 'detective@example.test', password: 'Correct-Horse-🔒-2026' }),
    ).rejects.toMatchObject({ code: 'CSRF_INVALID' })

    expect(authRequests.requestLogin).toHaveBeenCalledTimes(1)
    expect(authRequests.requestLogin).toHaveBeenCalledWith(
      { email: 'detective@example.test', password: 'Correct-Horse-🔒-2026' },
      'stale-token',
    )
    expect(authRequests.requestCsrfToken).toHaveBeenCalledTimes(2)
    expect(auth.csrfToken).toBe('fresh-token')
    expect(auth.requestError.message).toBe(
      'Your security check expired. Review the form and try again.',
    )
    expect(auth.requestError.message).not.toContain('private backend detail')
  })

  it('ignores a restoration response that arrives after local invalidation', async () => {
    let resolveCurrentUser
    authRequests.requestCurrentUser.mockReturnValue(
      new Promise((resolve) => {
        resolveCurrentUser = resolve
      }),
    )
    const auth = useAuthStore()
    const restoring = auth.restoreSession({ force: true })
    auth.invalidateSession()
    resolveCurrentUser(account)

    await expect(restoring).resolves.toBeNull()
    expect(auth.status).toBe('anonymous')
    expect(auth.user).toBeNull()
    expect(authRequests.requestCsrfToken).not.toHaveBeenCalled()
  })

  it('returns the newer signed-in account when a stale restore finishes after login', async () => {
    let resolveCurrentUser
    authRequests.requestCurrentUser.mockReturnValue(
      new Promise((resolve) => {
        resolveCurrentUser = resolve
      }),
    )
    const newerAccount = { ...account, id: 'new-session-id', username: 'NewSession' }
    authRequests.requestCsrfToken.mockResolvedValue('pre-login-token')
    authRequests.requestLogin.mockResolvedValue({ user: newerAccount, csrfToken: 'login-token' })
    const auth = useAuthStore()

    const restoring = auth.restoreSession({ force: true })
    await auth.login({ email: account.email, password: 'Correct-Horse-🔒-2026' })
    resolveCurrentUser(account)

    await expect(restoring).resolves.toMatchObject({
      id: newerAccount.id,
      username: newerAccount.username,
    })
    expect(auth.user).toMatchObject({ id: newerAccount.id, username: newerAccount.username })
    expect(auth.csrfToken).toBe('login-token')
  })

  it('blocks a restore that starts during a login mutation', async () => {
    let finishLogin
    authRequests.requestCsrfToken.mockResolvedValue('pre-login-token')
    authRequests.requestLogin.mockReturnValue(
      new Promise((resolve) => {
        finishLogin = resolve
      }),
    )
    const auth = useAuthStore()

    const signingIn = auth.login({ email: account.email, password: 'Correct-Horse-🔒-2026' })
    await Promise.resolve()
    await expect(auth.restoreSession({ force: true })).rejects.toMatchObject({
      code: 'ACCOUNT_ACTION_PENDING',
    })
    finishLogin({ user: account, csrfToken: 'login-token' })
    await expect(signingIn).resolves.toMatchObject({ username: account.username })
  })

  it('keeps the user visible while logout is pending and clears it after success', async () => {
    authRequests.requestCsrfToken.mockResolvedValue('anonymous-token')
    authRequests.requestRegistration.mockResolvedValue({
      user: account,
      csrfToken: 'signed-in-token',
    })
    let finishLogout
    authRequests.requestLogout.mockReturnValue(
      new Promise((resolve) => {
        finishLogout = resolve
      }),
    )
    const auth = useAuthStore()
    await auth.register({
      email: account.email,
      username: account.username,
      password: 'Correct-Horse-🔒-2026',
      avatarId: account.avatarId,
    })

    const signingOut = auth.logout()
    expect(auth.logoutPending).toBe(true)
    expect(auth.user.username).toBe(account.username)
    await expect(auth.restoreSession({ force: true })).rejects.toMatchObject({
      code: 'ACCOUNT_ACTION_PENDING',
    })
    expect(authRequests.requestCurrentUser).not.toHaveBeenCalled()
    finishLogout()
    await signingOut

    expect(auth.logoutPending).toBe(false)
    expect(auth.status).toBe('anonymous')
    expect(auth.user).toBeNull()
  })

  it('keeps the account available when logout could not reach the server', async () => {
    authRequests.requestCsrfToken.mockResolvedValue('anonymous-token')
    authRequests.requestRegistration.mockResolvedValue({
      user: account,
      csrfToken: 'signed-in-token',
    })
    authRequests.requestLogout.mockRejectedValue(new Error('private transport details'))
    const auth = useAuthStore()
    await auth.register({
      email: account.email,
      username: account.username,
      password: 'Correct-Horse-🔒-2026',
      avatarId: account.avatarId,
    })

    await expect(auth.logout()).rejects.toMatchObject({
      message: 'We could not reach Sharlock. Check your connection and try again.',
    })
    expect(auth.status).toBe('authenticated')
    expect(auth.user.username).toBe(account.username)
    expect(auth.logoutPending).toBe(false)
    expect(auth.requestError.message).not.toContain('private transport details')
  })

  it('invalidates identity after an authenticated restore returns 401', async () => {
    authRequests.requestCurrentUser.mockRejectedValue(rejectedAuth('AUTHENTICATION_REQUIRED', 401))
    const auth = useAuthStore()

    await expect(auth.restoreSession({ force: true })).resolves.toBeNull()
    expect(auth.status).toBe('anonymous')
    expect(auth.user).toBeNull()
    expect(auth.requestError).toBeNull()
  })

  it('maps failed credentials to a safe message without exposing backend details', async () => {
    authRequests.requestCsrfToken.mockResolvedValue('token')
    authRequests.requestLogin.mockRejectedValue(rejectedAuth('INVALID_CREDENTIALS', 401))
    const auth = useAuthStore()

    await expect(
      auth.login({ email: 'detective@example.test', password: 'Correct-Horse-🔒-2026' }),
    ).rejects.toMatchObject({ message: 'Email or password is incorrect.' })
    expect(auth.requestError.message).toBe('Email or password is incorrect.')
    expect(auth.requestError.message).not.toContain('private backend detail')
    expect(auth.status).toBe('unknown')
  })

  it('uses safe fallback messages for prototype-named error codes', async () => {
    authRequests.requestCsrfToken.mockResolvedValue('token')
    const auth = useAuthStore()

    for (const code of ['constructor', '__proto__', 'toString']) {
      authRequests.requestLogin.mockRejectedValueOnce(
        rejectedAuth(code, 400, `private detail for ${code}`),
      )

      await expect(
        auth.login({ email: 'detective@example.test', password: 'Correct-Horse-🔒-2026' }),
      ).rejects.toMatchObject({
        message: 'Sharlock could not complete that request. Please try again.',
      })
      expect(auth.requestError.message).toBe(
        'Sharlock could not complete that request. Please try again.',
      )
      expect(auth.requestError.message).not.toContain(`private detail for ${code}`)
    }
  })
})

describe('auth forms and account summary', () => {
  it('accepts a 12-code-point password with required composition and emits only approved fields', async () => {
    const wrapper = mount(RegisterForm)
    const password = 'AlphaBravo1!'
    expect(Array.from(password)).toHaveLength(12)
    await wrapper.get('#register-email').setValue('policy-check@example.test')
    await wrapper.get('#register-username').setValue('Policy_Check')
    await wrapper.get('#register-password').setValue(password)
    await wrapper.get('#register-confirmation').setValue(password)

    expect(wrapper.get('#register-password-hint').text().replace(/\s+/g, ' ').trim()).toBe(
      'Use 12–128 characters, including an uppercase letter and a special character. Spaces are allowed.',
    )

    await wrapper.get('form').trigger('submit')

    const payload = wrapper.emitted('submit')[0][0]
    expect(Object.keys(payload)).toEqual(['email', 'username', 'password', 'avatarId'])
    expect(payload).toEqual({
      email: 'policy-check@example.test',
      username: 'Policy_Check',
      password,
      avatarId: 'mint',
    })
    wrapper.unmount()
  })

  it('accepts a 32-character username and rejects 33 characters', async () => {
    const wrapper = mount(RegisterForm)
    const username = wrapper.get('#register-username')
    const accepted = 'A'.repeat(32)
    const rejected = 'B'.repeat(33)
    await wrapper.get('#register-email').setValue('policy-check@example.test')
    await username.setValue(accepted)
    await wrapper.get('#register-password').setValue('AlphaBravo1!')
    await wrapper.get('#register-confirmation').setValue('AlphaBravo1!')

    expect(username.attributes('maxlength')).toBe('32')
    expect(wrapper.get('#register-username-hint').text()).toContain('3–32')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')[0][0].username).toBe(accepted)

    await username.setValue(rejected)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('#register-username').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#register-username-error').text()).toContain('3 to 32')
    expect(wrapper.emitted('submit')).toHaveLength(1)
    wrapper.unmount()
  })

  it.each([
    ['uppercase letter', 'alphabravo1!'],
    ['special character', 'AlphaBravo12'],
  ])('blocks a 12-code-point password without a %s', async (_label, password) => {
    const wrapper = mount(RegisterForm)
    expect(Array.from(password)).toHaveLength(12)
    await wrapper.get('#register-email').setValue('policy-check@example.test')
    await wrapper.get('#register-username').setValue('Policy_Check')
    await wrapper.get('#register-password').setValue(password)
    await wrapper.get('#register-confirmation').setValue(password)
    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('#register-password').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#register-password-error').text()).not.toBe('')
    expect(wrapper.emitted('submit')).toBeUndefined()
    wrapper.unmount()
  })

  it('blocks registration on confirmation mismatch and excludes confirmation after match', async () => {
    const wrapper = mount(RegisterForm)
    await wrapper.get('#register-email').setValue('detective@example.test')
    await wrapper.get('#register-username').setValue('Case_Finder')
    await wrapper.get('#register-password').setValue('Correct-Horse-🔒-2026')
    await wrapper.get('#register-confirmation').setValue('Different-Horse-🔒-2026')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.text()).toContain('Passwords must match.')
    expect(wrapper.emitted('submit')).toBeUndefined()

    await wrapper.get('#register-confirmation').setValue('Correct-Horse-🔒-2026')
    await wrapper.get('form').trigger('submit')
    const payload = wrapper.emitted('submit')[0][0]
    expect(payload).toEqual({
      email: 'detective@example.test',
      username: 'Case_Finder',
      password: 'Correct-Horse-🔒-2026',
      avatarId: 'mint',
    })
    expect(payload).not.toHaveProperty('passwordConfirmation')
    wrapper.unmount()
  })

  it('does not truncate valid Unicode passwords', async () => {
    const wrapper = mount(LoginForm)
    const password = '🔐'.repeat(15)
    const input = wrapper.get('#login-password')
    expect(input.attributes('maxlength')).toBeUndefined()
    await wrapper.get('#login-email').setValue('detective@example.test')
    await input.setValue(password)
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')[0][0].password).toBe(password)
    wrapper.unmount()
  })

  it('disables editable sign-in and registration controls while pending', () => {
    const login = mount(LoginForm, { props: { pending: true } })
    expect(login.get('#login-email').element.disabled).toBe(true)
    expect(login.get('#login-password').element.disabled).toBe(true)
    expect(login.get('.auth-password-toggle').element.disabled).toBe(true)
    login.unmount()

    const register = mount(RegisterForm, { props: { pending: true } })
    for (const selector of [
      '#register-email',
      '#register-username',
      '#register-password',
      '#register-confirmation',
    ]) {
      expect(register.get(selector).element.disabled).toBe(true)
    }
    expect(
      register.findAll('.auth-password-toggle').every((button) => button.element.disabled),
    ).toBe(true)
    expect(
      register.findAll('input[type="radio"]').every((input) => input.element.matches(':disabled')),
    ).toBe(true)
    register.unmount()
  })

  it('lists the six authoritative keyboard-operable avatar presets', async () => {
    const wrapper = mount(AvatarPicker, { props: { selected: 'mint' } })
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(6)
    await wrapper.get('input[value="blue"]').setValue()
    expect(wrapper.emitted('update:selected')[0]).toEqual(['blue'])
    expect(wrapper.text()).toContain('Blue Cap')
    expect(wrapper.text()).toContain('Peach Bow')
    wrapper.unmount()
  })

  it('shows a real account summary without fabricated scores or achievements', () => {
    const wrapper = mount(AccountSummary, {
      props: { status: 'authenticated', user: account },
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    expect(wrapper.text()).toContain('Case_Finder')
    expect(wrapper.text()).toContain('detective@example.test')
    expect(wrapper.text()).toContain('Results are not saved')
    expect(wrapper.text()).not.toMatch(/points|badge|rank|completed/i)
    expect(wrapper.get('img').attributes('src')).toBe('/images/avatars/blue.png')
    wrapper.unmount()
  })

  it('renders the login and registration pages inside the shared router shell', async () => {
    const loginRouter = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/login', component: LoginPage }],
    })
    await loginRouter.push('/login')
    const login = mount(LoginPage, { global: { plugins: [createPinia(), loginRouter] } })
    expect(login.get('h1').text()).toBe('Sign in to Sharlock')
    expect(login.get('form').exists()).toBe(true)
    login.unmount()

    const registerRouter = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/register', component: RegisterPage }],
    })
    await registerRouter.push('/register')
    const register = mount(RegisterPage, {
      global: { plugins: [createPinia(), registerRouter] },
    })
    expect(register.get('h1').text()).toBe('Create a student account')
    expect(register.findAll('input[name="avatarId"]')).toHaveLength(6)
    register.unmount()
  })
})
