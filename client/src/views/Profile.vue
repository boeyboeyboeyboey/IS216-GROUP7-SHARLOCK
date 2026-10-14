<script setup>
defineOptions({ name: 'SharlockProfile' })
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PixelIcon from '../components/town/PixelIcon.vue'
import TrophyCase from '../components/portal/TrophyCase.vue'
import SessionNotice from '../features/auth/components/SessionNotice.vue'
import { avatarFor } from '../features/auth/avatars.js'
import { useAuthStore } from '../features/auth/store.js'

const route = useRoute()
const auth = useAuthStore()
const progressPage = computed(() => route.path === '/progress')
const avatar = computed(() => avatarFor(auth.user?.avatarId))
const errorMessage = computed(() => auth.requestError?.message || 'Unable to check your account.')
async function retrySession() {
  try {
    await auth.restoreSession({ force: true })
  } catch {
    // the auth store retains safe connection feedback for retry
  }
}
</script>

<template>
  <div class="profile-view">
    <p class="eyebrow">{{ progressPage ? 'YOUR LEARNING JOURNEY' : 'YOUR DETECTIVE DESK' }}</p>
    <h1 tabindex="-1">
      {{ progressPage ? 'Your learning progress.' : 'A curious mind looks good on you.' }}
    </h1>
    <p class="page-description">Your account, your capybara companion and your next discoveries.</p>

    <template v-if="auth.status === 'authenticated' && auth.user">
      <section class="profile-overview" aria-label="Your profile">
        <div class="large-avatar">
          <img
            :src="avatar.path"
            class="avatar-image"
            width="144"
            height="144"
            :alt="avatar.label"
          />
        </div>
        <div>
          <span class="title-pill">YOUR ACCOUNT</span>
          <h2>{{ auth.user.username }}</h2>
          <p>{{ auth.user.email }}</p>
        </div>
        <RouterLink to="/" class="btn btn-secondary">
          Town map <PixelIcon name="arrow" :size="18" aria-hidden="true" />
        </RouterLink>
      </section>
      <p class="preview-notice">
        Results are not saved. Your account and avatar are saved, but game progress, scores and
        achievements are not recorded yet.
      </p>
      <TrophyCase />
    </template>

    <section v-else-if="auth.status === 'anonymous'" class="profile-overview" aria-label="Sign in">
      <div>
        <h2>Make this desk your own.</h2>
        <p>Sign in or create an account to see your profile and enter Sharlock Town.</p>
        <div class="d-flex flex-wrap gap-3">
          <RouterLink to="/login" class="btn btn-primary">Sign in</RouterLink>
          <RouterLink to="/register" class="btn btn-secondary">Create account</RouterLink>
        </div>
      </div>
    </section>
    <p v-else-if="auth.status === 'loading'" role="status">Checking your account…</p>
    <SessionNotice v-else :message="errorMessage" @retry="retrySession">
      <RouterLink to="/login">Sign in</RouterLink>
      <span> or </span>
      <RouterLink to="/register">Create account</RouterLink>
    </SessionNotice>
  </div>
</template>

<style scoped>
.avatar-image {
  image-rendering: pixelated;
}
</style>
