<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PixelIcon from '../../../components/town/PixelIcon.vue'
import { useAuthStore } from '../store.js'
import LoginForm from '../components/LoginForm.vue'
import SessionNotice from '../components/SessionNotice.vue'
import '../auth.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const form = ref(null)
const pending = ref(false)
const introAvatar = '/images/town/capybara-mint.svg'
const expiredNotice = computed(() => route.query.reason === 'expired')
const fieldErrors = computed(() => auth.requestError?.fieldErrors || {})
const errorMessage = computed(() => auth.requestError?.message || '')

async function signIn(payload) {
  if (pending.value) return
  pending.value = true
  try {
    const user = await auth.login(payload)
    if (user) {
      form.value?.clearSecrets()
      await router.replace('/')
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

      <SessionNotice
        v-if="expiredNotice"
        message="Your session ended. Sign in again to continue. Your unfinished action was not repeated."
        :pending="pending"
        @retry="checkSession"
      />

      <LoginForm
        ref="form"
        :pending="pending"
        :error="errorMessage"
        :field-errors="fieldErrors"
        @submit="signIn"
      />

      <p class="auth-switch">
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
