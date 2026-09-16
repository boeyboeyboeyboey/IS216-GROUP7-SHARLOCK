<script setup>
import { PhMedal } from '@phosphor-icons/vue'
defineProps({ achievements: { type: Array, default: () => [] } })
</script>

<template>
  <section class="trophy-case" aria-labelledby="trophy-heading">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Little wins. Lasting skills.</p>
        <h2 id="trophy-heading">Your trophy case</h2>
      </div>
      <PhMedal :size="32" weight="duotone" aria-hidden="true" />
    </div>
    <ul v-if="achievements.length" class="achievement-list">
      <li v-for="badge in achievements" :key="badge.id" class="achievement-badge">
        <div class="badge-art">
          <img :src="`/images/${badge.icon}-placeholder.svg`" width="96" height="96" alt="" />
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
