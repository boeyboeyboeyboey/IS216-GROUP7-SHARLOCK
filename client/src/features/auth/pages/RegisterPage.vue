<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import PixelIcon from '../../../components/town/PixelIcon.vue'
import { useAuthStore } from '../store.js'
import RegisterForm from '../components/RegisterForm.vue'
import { resolveEnrollmentDestination } from '../../cohorts/journey.js'
import '../auth.css'

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
      continuationError.value = 'Your account is ready. Class setup is unavailable. Try Continue again.'
    }
  } finally {
    continuing.value = false
  }
}

async function createAccount(payload) {
  if (pending.value) return
  pending.value = true
  try {
    const user = await auth.register(payload)
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
</script>

<template>
  <section class="auth-page auth-page--register" aria-labelledby="register-title">
    <div class="auth-page__art" aria-hidden="true">
      <img :src="introAvatar" width="180" height="135" alt="" />
      <span class="auth-page__spark"><PixelIcon name="star" :size="24" /></span>
    </div>
    <section class="auth-card">
      <p class="auth-eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
      <h1 id="register-title" tabindex="-1">Create a student account</h1>
      <p class="auth-intro">Choose a name and capybara portrait for your detective desk.</p>

      <RegisterForm
        v-if="!signedIn"
        ref="form"
        :pending="pending"
        :error="errorMessage"
        :field-errors="fieldErrors"
        @submit="createAccount"
      />

      <div v-else aria-live="polite">
        <p>Your account is ready and you are signed in.</p>
        <p v-if="continuationError" role="alert">{{ continuationError }}</p>
        <button class="btn btn-primary" type="button" :disabled="pending || continuing" @click="continueAfterSignIn">
          Continue
        </button>
      </div>

      <p v-if="!signedIn" class="auth-switch">
        Already have an account?
        <RouterLink to="/login">Sign in</RouterLink>
      </p>
    </section>
    <aside class="auth-aside">
      <PixelIcon name="shield" :size="30" aria-hidden="true" />
      <h2>Start with your own detective</h2>
      <p>Registration signs you in automatically. Join a class or skip ahead to personal play. Phishing Post-Mortem results save to your account; other games are not saved yet.</p>
      <RouterLink to="/about" class="auth-aside__link">
        About Sharlock <PixelIcon name="arrow" :size="16" aria-hidden="true" />
      </RouterLink>
    </aside>
  </section>
</template>
