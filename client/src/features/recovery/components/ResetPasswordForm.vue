<script setup>
import { nextTick, ref } from 'vue'
import { parseNewPasswordInput } from '../../auth/validation.js'

defineProps({
  pending: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['submit'])
const password = ref('')
const confirmation = ref('')
const localError = ref('')
const summary = ref(null)

function focusSummary() {
  nextTick(() => summary.value?.focus())
}

function clearSecrets() {
  password.value = ''
  confirmation.value = ''
  localError.value = ''
}

function submit() {
  localError.value = ''
  if (Array.from(password.value).length < 12) {
    localError.value = 'Use at least 12 characters.'
  } else {
    try {
      parseNewPasswordInput(password.value)
    } catch {
      localError.value = 'That password could not be accepted. Please choose a different password.'
    }
  }
  if (!localError.value && password.value !== confirmation.value) {
    localError.value = 'Passwords must match.'
  }
  if (localError.value) {
    focusSummary()
    return
  }
  emit('submit', { password: password.value, confirmation: confirmation.value })
}

defineExpose({ clearSecrets })
</script>

<template>
  <form class="auth-form recovery-reset-form" @submit.prevent="submit">
    <div class="auth-field">
      <label for="reset-password">New password</label>
      <input
        id="reset-password"
        v-model="password"
        type="password"
        name="new-password"
        autocomplete="new-password"
        required
        :disabled="pending"
        :aria-invalid="Boolean(localError || error)"
        aria-describedby="reset-password-hint reset-password-error"
      />
      <small id="reset-password-hint">
        Use at least 12 characters, including an uppercase letter and a special character.
      </small>
    </div>
    <div class="auth-field">
      <label for="reset-password-confirmation">Confirm password</label>
      <input
        id="reset-password-confirmation"
        v-model="confirmation"
        type="password"
        name="new-password-confirmation"
        autocomplete="new-password"
        required
        :disabled="pending"
        :aria-invalid="Boolean(localError || error)"
        aria-describedby="reset-password-error"
      />
    </div>
    <p
      v-if="localError || error"
      id="reset-password-error"
      ref="summary"
      class="recovery-alert"
      role="alert"
      tabindex="-1"
    >
      {{ localError || error }}
    </p>
    <button class="btn btn-primary recovery-button" type="submit" :disabled="pending">
      {{ pending ? 'Updating password…' : 'Set password' }}
    </button>
  </form>
</template>
