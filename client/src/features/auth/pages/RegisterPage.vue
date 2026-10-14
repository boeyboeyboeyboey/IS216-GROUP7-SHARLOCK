<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PixelIcon from '../../../components/town/PixelIcon.vue'
import { useAuthStore } from '../store.js'
import RegisterForm from '../components/RegisterForm.vue'
import '../auth.css'

const router = useRouter()
const auth = useAuthStore()
const form = ref(null)
const pending = ref(false)
const introAvatar = '/images/town/capybara-mint.svg'
const fieldErrors = computed(() => auth.requestError?.fieldErrors || {})
const errorMessage = computed(() => auth.requestError?.message || '')

async function createAccount(payload) {
  if (pending.value) return
  pending.value = true
  try {
    const user = await auth.register(payload)
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
        ref="form"
        :pending="pending"
        :error="errorMessage"
        :field-errors="fieldErrors"
        @submit="createAccount"
      />

      <p class="auth-switch">
        Already have an account?
        <RouterLink to="/login">Sign in</RouterLink>
      </p>
    </section>
    <aside class="auth-aside">
      <PixelIcon name="shield" :size="30" aria-hidden="true" />
      <h2>Start with your own detective</h2>
      <p>Registration signs you in automatically. Class and saved-results features come later.</p>
      <RouterLink to="/about" class="auth-aside__link">
        About Sharlock <PixelIcon name="arrow" :size="16" aria-hidden="true" />
      </RouterLink>
    </aside>
  </section>
</template>
