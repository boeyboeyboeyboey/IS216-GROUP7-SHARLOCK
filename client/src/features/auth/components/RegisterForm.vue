<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { parseRegistrationInput } from '../validation.js'
import AvatarPicker from './AvatarPicker.vue'

const props = defineProps({
  pending: { type: Boolean, default: false },
  error: { type: String, default: '' },
  fieldErrors: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['submit'])

const email = ref('')
const username = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const avatarId = ref('mint')
const showPassword = ref(false)
const showConfirmation = ref(false)
const localErrors = ref(Object.create(null))
const summary = ref(null)

function fieldError(name) {
  return localErrors.value[name] || props.fieldErrors[name] || ''
}

const emailError = computed(() => fieldError('email'))
const usernameError = computed(() => fieldError('username'))
const passwordError = computed(() => fieldError('password'))
const confirmationError = computed(() => fieldError('passwordConfirmation'))
const avatarError = computed(() => fieldError('avatarId'))
const hasFieldErrors = computed(() =>
  [
    emailError.value,
    usernameError.value,
    passwordError.value,
    confirmationError.value,
    avatarError.value,
  ].some(Boolean),
)

function focusSummary() {
  nextTick(() => summary.value?.focus())
}

function submit() {
  localErrors.value = Object.create(null)
  try {
    const input = parseRegistrationInput({
      email: email.value,
      username: username.value,
      password: password.value,
      avatarId: avatarId.value,
    })
    if (password.value !== passwordConfirmation.value) {
      localErrors.value.passwordConfirmation = 'Passwords must match.'
      focusSummary()
      return
    }
    emit('submit', {
      email: input.emailNormalized,
      username: input.username.display,
      password: input.password,
      avatarId: input.avatarId,
    })
  } catch (error) {
    localErrors.value = error.fieldErrors || Object.create(null)
    focusSummary()
  }
}

function clearSecrets() {
  password.value = ''
  passwordConfirmation.value = ''
  showPassword.value = false
  showConfirmation.value = false
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
  <form class="auth-form auth-form--register" novalidate @submit.prevent="submit">
    <div
      v-if="error || hasFieldErrors"
      ref="summary"
      class="auth-error-summary"
      role="alert"
      tabindex="-1"
      aria-labelledby="register-error-title"
    >
      <strong id="register-error-title">We couldn't create your account yet.</strong>
      <p v-if="error">{{ error }}</p>
      <p v-else>Check the highlighted fields and try again.</p>
    </div>

    <div class="auth-field">
      <label for="register-email">Email address</label>
      <input
        id="register-email"
        v-model="email"
        type="email"
        name="email"
        autocomplete="email"
        inputmode="email"
        required
        :disabled="pending"
        :aria-invalid="Boolean(emailError)"
        :aria-describedby="
          emailError ? 'register-email-hint register-email-error' : 'register-email-hint'
        "
      />
      <small id="register-email-hint">Use this email to sign in.</small>
      <p v-if="emailError" id="register-email-error" class="auth-field-error">{{ emailError }}</p>
    </div>

    <div class="auth-field">
      <label for="register-username">Username</label>
      <input
        id="register-username"
        v-model="username"
        type="text"
        name="username"
        autocomplete="username"
        required
        :disabled="pending"
        :aria-invalid="Boolean(usernameError)"
        :aria-describedby="
          usernameError
            ? 'register-username-hint register-username-error'
            : 'register-username-hint'
        "
      />
      <small id="register-username-hint">3–24 letters, numbers, underscores or hyphens.</small>
      <p v-if="usernameError" id="register-username-error" class="auth-field-error">
        {{ usernameError }}
      </p>
    </div>

    <div class="auth-field">
      <label for="register-password">Password</label>
      <div class="auth-password-control">
        <input
          id="register-password"
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          name="new-password"
          autocomplete="new-password"
          required
          :disabled="pending"
          :aria-invalid="Boolean(passwordError)"
          :aria-describedby="
            passwordError
              ? 'register-password-hint register-password-error'
              : 'register-password-hint'
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
      <small id="register-password-hint">Use 15–128 characters. Spaces are allowed.</small>
      <p v-if="passwordError" id="register-password-error" class="auth-field-error">
        {{ passwordError }}
      </p>
    </div>

    <div class="auth-field">
      <label for="register-confirmation">Confirm password</label>
      <div class="auth-password-control">
        <input
          id="register-confirmation"
          v-model="passwordConfirmation"
          :type="showConfirmation ? 'text' : 'password'"
          name="passwordConfirmation"
          autocomplete="new-password"
          required
          :disabled="pending"
          :aria-invalid="Boolean(confirmationError)"
          :aria-describedby="
            confirmationError ? 'register-confirmation-error' : 'register-confirmation-hint'
          "
        />
        <button
          class="auth-password-toggle"
          type="button"
          :aria-pressed="showConfirmation"
          :aria-label="showConfirmation ? 'Hide confirmation' : 'Show confirmation'"
          :disabled="pending"
          @click="showConfirmation = !showConfirmation"
        >
          {{ showConfirmation ? 'Hide' : 'Show' }}
        </button>
      </div>
      <small id="register-confirmation-hint">Enter the same password again.</small>
      <p v-if="confirmationError" id="register-confirmation-error" class="auth-field-error">
        {{ confirmationError }}
      </p>
    </div>

    <AvatarPicker
      v-model:selected="avatarId"
      :disabled="pending"
      :aria-invalid="Boolean(avatarError)"
      :aria-describedby="avatarError ? 'register-avatar-error' : undefined"
    />
    <p v-if="avatarError" id="register-avatar-error" class="auth-field-error">
      {{ avatarError }}
    </p>

    <button class="btn btn-primary auth-submit" type="submit" :disabled="pending">
      {{ pending ? 'Creating account…' : 'Create account' }}
    </button>
  </form>
</template>
