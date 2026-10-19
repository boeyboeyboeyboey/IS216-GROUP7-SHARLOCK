<script setup>
import { computed } from 'vue'
import PixelIcon from '../../../components/town/PixelIcon.vue'
import { avatarFor } from '../avatars.js'
import SessionNotice from './SessionNotice.vue'
import '../auth.css'

const props = defineProps({
  status: { type: String, default: 'unknown' },
  user: { type: Object, default: null },
  logoutPending: { type: Boolean, default: false },
  error: { type: [String, Object], default: null },
})
defineEmits(['sign-out', 'retry-session'])

const avatar = computed(() => (props.user ? avatarFor(props.user.avatarId) : null))
const errorMessage = computed(() =>
  typeof props.error === 'string' ? props.error : props.error?.message || '',
)
</script>

<template>
  <section class="auth-summary" aria-label="Account">
    <div v-if="status === 'loading' || status === 'unknown'" class="auth-summary__state">
      <span class="auth-summary__eyebrow">YOUR ACCOUNT</span>
      <p>
        {{
          status === 'loading'
            ? 'Checking your account…'
            : 'Your account status is not checked yet.'
        }}
      </p>
      <SessionNotice
        v-if="errorMessage"
        :message="errorMessage"
        :pending="status === 'loading'"
        @retry="$emit('retry-session')"
      />
      <button
        v-else
        class="btn btn-secondary"
        type="button"
        :disabled="status === 'loading'"
        @click="$emit('retry-session')"
      >
        {{ status === 'loading' ? 'Checking…' : 'Check account' }}
      </button>
    </div>

    <div v-else-if="status === 'anonymous'" class="auth-summary__state">
      <span class="auth-summary__eyebrow">YOUR ACCOUNT</span>
      <p>Sign in to see your detective profile.</p>
      <div class="auth-summary__links">
        <RouterLink class="btn btn-primary" to="/login">Sign in</RouterLink>
        <RouterLink class="btn btn-secondary" to="/register">Create account</RouterLink>
      </div>
    </div>

    <div v-else-if="user" class="auth-summary__identity">
      <span class="auth-summary__eyebrow">YOUR ACCOUNT</span>
      <div class="auth-summary__person">
        <img
          v-if="avatar"
          :src="avatar.path"
          width="72"
          height="72"
          :alt="`${avatar.label} capybara avatar`"
        />
        <div>
          <h2>{{ user.username }}</h2>
          <p>{{ user.email }}</p>
        </div>
      </div>
      <p class="auth-summary__truth">Phishing results saved</p>
      <SessionNotice
        v-if="errorMessage"
        :message="errorMessage"
        :pending="logoutPending"
        @retry="$emit('retry-session')"
      />
      <button
        class="btn btn-secondary auth-summary__sign-out"
        type="button"
        :disabled="logoutPending"
        @click="$emit('sign-out')"
      >
        <PixelIcon name="arrow" :size="18" aria-hidden="true" />
        {{ logoutPending ? 'Signing out…' : 'Sign out' }}
      </button>
    </div>

    <SessionNotice
      v-else-if="errorMessage"
      :message="errorMessage"
      @retry="$emit('retry-session')"
    />
  </section>
</template>
