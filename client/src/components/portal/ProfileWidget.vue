<script setup>
import { PhStar, PhArrowUpRight } from '@phosphor-icons/vue'
defineProps({
  username: { type: String, required: true },
  title: { type: String, default: 'Novice Sleuth' },
  points: { type: Number, default: 0, validator: Number.isInteger },
  avatar: { type: String, default: '/images/sharlock-placeholder.svg' },
})
</script>

<template>
  <section class="profile-widget" aria-label="Detective profile">
    <div class="avatar-ring">
      <img
        :src="avatar"
        class="avatar-image"
        width="80"
        height="80"
        alt="Custom avatar placeholder: Sharlock, a friendly capybara detective wearing a monocle"
      />
    </div>
    <p class="profile-name">{{ username }}</p>
    <p class="small mb-3">{{ title }}</p>
    <span class="points-pill"
      ><PhStar weight="duotone" :size="18" aria-hidden="true" />
      {{ points.toLocaleString() }} points</span
    >
    <RouterLink to="/profile" class="profile-link"
      >Your detective profile <PhArrowUpRight :size="16" aria-hidden="true"
    /></RouterLink>
    <span class="preview-caption">Sample profile</span>
  </section>
</template>
