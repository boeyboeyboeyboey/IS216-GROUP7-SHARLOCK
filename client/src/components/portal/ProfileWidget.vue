<script setup>
import PixelIcon from '../town/PixelIcon.vue'
defineProps({
  username: { type: String, required: true },
  title: { type: String, default: 'Novice Sleuth' },
  points: { type: Number, default: 0, validator: Number.isInteger },
  avatar: { type: String, default: '/images/town/capybara-mint.svg' },
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
        alt="Sample avatar: a pixel-art capybara wearing a mint scarf"
      />
    </div>
    <p class="profile-name">{{ username }}</p>
    <p class="small mb-3">{{ title }}</p>
    <span class="points-pill"
      ><PixelIcon name="star" :size="18" aria-hidden="true" />
      {{ points.toLocaleString() }} points</span
    >
    <RouterLink to="/profile" class="profile-link"
      >Your detective profile <PixelIcon name="arrow" :size="16" aria-hidden="true"
    /></RouterLink>
    <span class="preview-caption">Sample profile</span>
  </section>
</template>
