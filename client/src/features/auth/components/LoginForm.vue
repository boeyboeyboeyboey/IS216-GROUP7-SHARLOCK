<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { parseLoginInput } from '../validation.js'

const props = defineProps({
  pending: { type: Boolean, default: false },
  error: { type: String, default: '' },
  fieldErrors: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['submit'])

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const localErrors = ref(Object.create(null))
const summary = ref(null)
const emailError = computed(() => localErrors.value.email || props.fieldErrors.email || '')
const passwordError = computed(() => localErrors.value.password || props.fieldErrors.password || '')
const hasFieldErrors = computed(() => Boolean(emailError.value || passwordError.value))

function focusSummary() {
  nextTick(() => summary.value?.focus())
}

function submit() {
  localErrors.value = Object.create(null)
  try {
    const input = parseLoginInput({ email: email.value, password: password.value })
    emit('submit', { email: input.emailNormalized, password: input.password })
  } catch (error) {
    localErrors.value = error.fieldErrors || Object.create(null)
    focusSummary()
  }
}

function clearSecrets() {
  password.value = ''
  showPassword.value = false
}

watch(
  () => props.error,
  (error) => {
    if (error) focusSummary()
  },
)
onBeforeUnmount(clearSecrets)
defineExpose({ clearSecrets })
</script>

<template>
  <form class="auth-form" novalidate @submit.prevent="submit">
    <div
      v-if="error || hasFieldErrors"
      ref="summary"
      class="auth-error-summary"
      role="alert"
      tabindex="-1"
      aria-labelledby="login-error-title"
    >
      <strong id="login-error-title">We couldn't sign you in yet.</strong>
      <p v-if="error">{{ error }}</p>
      <p v-else>Check the highlighted fields and try again.</p>
    </div>

    <div class="auth-field">
      <label for="login-email">Email address</label>
      <input
        id="login-email"
        v-model="email"
        type="email"
        name="email"
        autocomplete="username"
        inputmode="email"
        required
        :disabled="pending"
        :aria-invalid="Boolean(emailError)"
        :aria-describedby="emailError ? 'login-email-hint login-email-error' : 'login-email-hint'"
      />
      <small id="login-email-hint">Use this email to sign in.</small>
      <p v-if="emailError" id="login-email-error" class="auth-field-error">{{ emailError }}</p>
    </div>

    <div class="auth-field">
      <label for="login-password">Password</label>
      <div class="auth-password-control">
        <input
          id="login-password"
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          name="password"
          autocomplete="current-password"
          required
          :disabled="pending"
          :aria-invalid="Boolean(passwordError)"
          :aria-describedby="
            passwordError ? 'login-password-hint login-password-error' : 'login-password-hint'
          "
        />
        <button
          class="auth-password-toggle"
          type="button"
          :aria-pressed="showPassword"
          :aria-label="showPassword ? 'Hide password' : 'Show password'"
          :disabled="pending"
          @click="showPassword = !showPassword"
        >
          {{ showPassword ? 'Hide' : 'Show' }}
        </button>
      </div>
      <small id="login-password-hint">Enter your account password.</small>
      <p v-if="passwordError" id="login-password-error" class="auth-field-error">
        {{ passwordError }}
      </p>
    </div>

    <button class="btn btn-primary auth-submit" type="submit" :disabled="pending">
      {{ pending ? 'Signing in…' : 'Sign in' }}
    </button>
  </form>
</template>
