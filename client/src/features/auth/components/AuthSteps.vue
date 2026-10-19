<script setup>
defineProps({
  current: { type: Number, required: true },
  total: { type: Number, default: 3 },
})
</script>

<template>
  <div class="auth-steps" role="img" :aria-label="`Step ${current} of ${total}`">
    <span
      v-for="step in total"
      :key="step"
      class="auth-steps__cell"
      :class="{ 'auth-steps__cell--on': step <= current }"
    ></span>
  </div>
</template>
