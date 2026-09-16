<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { PhArrowLeft, PhClock } from '@phosphor-icons/vue'
import { gameCatalog } from '../data/gameCatalog.js'
import NotFound from './NotFound.vue'
const route = useRoute()
const game = computed(() => gameCatalog.find((item) => item.id === route.params.gameId))
</script>
<template>
  <div v-if="game" class="case-preview">
    <RouterLink to="/dashboard" class="text-link"
      ><PhArrowLeft :size="18" aria-hidden="true" /> Back to town</RouterLink
    >
    <div class="case-preview-art">
      <img
        :src="`/images/${game.icon}-placeholder.svg`"
        class="game-art"
        width="170"
        height="170"
        :alt="`Soft 3D-style ${game.icon} placeholder for ${game.name}`"
      />
    </div>
    <p class="eyebrow">ACTIVITY PREVIEW</p>
    <h1 tabindex="-1">{{ game.name }}</h1>
    <p class="page-description">{{ game.description }}</p>
    <span class="node-detail justify-content-center"
      ><PhClock :size="17" aria-hidden="true" /> Planned case length: {{ game.duration }}</span
    >
    <div class="case-status">
      <h2>A new case is taking shape.</h2>
      <p>
        This is a preview of a planned activity. The playable case is being prepared; exploring this
        page does not change your points or progress.
      </p>
    </div>
    <RouterLink to="/dashboard" class="btn btn-primary">Keep exploring</RouterLink>
  </div>
  <NotFound v-else />
</template>
