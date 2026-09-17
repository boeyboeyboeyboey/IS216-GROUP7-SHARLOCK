<script setup>
import PixelIcon from '../town/PixelIcon.vue'
defineProps({ achievements: { type: Array, default: () => [] } })
</script>

<template>
  <section class="trophy-case" aria-labelledby="trophy-heading">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Little wins. Lasting skills.</p>
        <h2 id="trophy-heading">Your trophy case</h2>
      </div>
      <PixelIcon name="trophy" :size="32" aria-hidden="true" />
    </div>
    <ul v-if="achievements.length" class="achievement-list">
      <li v-for="badge in achievements" :key="badge.id" class="achievement-badge">
        <div class="badge-art">
          <PixelIcon :name="badge.icon" :size="64" />
        </div>
        <h3>{{ badge.name }}</h3>
        <p>{{ badge.description }}</p>
      </li>
    </ul>
    <p v-else class="empty-trophies">
      Your first badge is waiting. Complete a case to begin your collection.
    </p>
  </section>
</template>
