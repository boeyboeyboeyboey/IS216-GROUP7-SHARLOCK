<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PixelIcon from '../../../components/town/PixelIcon.vue'
import { useAuthStore } from '../store.js'
import LoginForm from '../components/LoginForm.vue'
import SessionNotice from '../components/SessionNotice.vue'
import { resolveEnrollmentDestination } from '../../cohorts/journey.js'
import '../auth.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const form = ref(null)
const pending = ref(false)
const signedIn = ref(false)
const continuing = ref(false)
const continuationError = ref('')
const controller = new AbortController()
onBeforeUnmount(() => controller.abort())
const introAvatar = '/images/town/capybara-mint.svg'
const expiredNotice = computed(() => route.query.reason === 'expired')
const passwordResetNotice = computed(() => route.query.passwordReset === '1')
const fieldErrors = computed(() => auth.requestError?.fieldErrors || {})
const errorMessage = computed(() => auth.requestError?.message || '')

async function continueAfterSignIn() {
  if (continuing.value) return
  continuing.value = true
  continuationError.value = ''
  try {
    const destination = await resolveEnrollmentDestination(auth.user, {
      signal: controller.signal,
      afterAccountAccess: true,
    })
    if (!controller.signal.aborted) await router.replace(destination)
  } catch {
    if (!controller.signal.aborted) {
      continuationError.value = 'You are signed in. Class setup is unavailable. Try Continue again.'
    }
  } finally {
    continuing.value = false
  }
}

async function signIn(payload) {
  if (pending.value) return
  pending.value = true
  try {
    const user = await auth.login(payload)
    if (user) {
      form.value?.clearSecrets()
      signedIn.value = true
      await continueAfterSignIn()
    }
  } catch {
    // the store keeps only the safe message for the form
  } finally {
    pending.value = false
  }
}

async function checkSession() {
  try {
    await auth.restoreSession({ force: true })
  } catch {
    // the store exposes only a safe recovery message
  }
}
</script>

<template>
  <section class="auth-page" aria-labelledby="login-title">
    <div class="auth-page__art" aria-hidden="true">
      <img :src="introAvatar" width="180" height="135" alt="" />
      <span class="auth-page__spark"><PixelIcon name="key" :size="24" /></span>
    </div>
    <section class="auth-card">
      <p class="auth-eyebrow">WELCOME BACK, DETECTIVE</p>
      <h1 id="login-title" tabindex="-1">Sign in to Sharlock</h1>
      <p class="auth-intro">Pick up your investigations with your Sharlock account.</p>

      <p v-if="passwordResetNotice" class="auth-field-hint" role="status">
        Your password was updated. Sign in with your new password.
      </p>

      <SessionNotice
        v-if="expiredNotice"
        message="Your session ended. Sign in again to continue. Your unfinished action was not repeated."
        :pending="pending"
        @retry="checkSession"
      />

      <LoginForm
        v-if="!signedIn"
        ref="form"
        :pending="pending"
        :error="errorMessage"
        :field-errors="fieldErrors"
        @submit="signIn"
      />

      <div v-else aria-live="polite">
        <p>You are signed in.</p>
        <p v-if="continuationError" role="alert">{{ continuationError }}</p>
        <button class="btn btn-primary" type="button" :disabled="pending || continuing" @click="continueAfterSignIn">
          Continue
        </button>
      </div>

      <p v-if="!signedIn" class="auth-switch">
        New to Sharlock?
        <RouterLink to="/register">Create a student account</RouterLink>
      </p>
    </section>
    <aside class="auth-aside">
      <PixelIcon name="lock" :size="30" aria-hidden="true" />
      <h2>Your account stays yours</h2>
      <p>Use your account to explore Sharlock Town.</p>
      <RouterLink to="/about" class="auth-aside__link">
        Meet Sharlock <PixelIcon name="arrow" :size="16" aria-hidden="true" />
      </RouterLink>
    </aside>
  </section>
</template>
