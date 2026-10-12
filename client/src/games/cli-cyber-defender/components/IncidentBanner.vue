<script setup>
import { computed } from 'vue'

const props = defineProps({
  incident: { type: Object, default: null },
  remainingMs: { type: Number, default: null },
  mode: { type: String, default: 'timed' },
})

const fraction = computed(() => {
  const total = props.incident?.windowSeconds
  if (!total || props.remainingMs == null) return 1
  return Math.max(0, Math.min(1, props.remainingMs / (total * 1000)))
})
const urgent = computed(() => props.remainingMs != null && props.remainingMs <= 3000)
</script>

<template>
  <section class="cli-banner" aria-label="Current incident">
    <template v-if="incident">
      <p class="cli-banner-meta">
        <span :class="['cli-severity', `cli-severity-${incident.alert.severity}`]">
          {{ incident.alert.severity }}
        </span>
        <span>Incident {{ incident.index + 1 }}</span>
        <span>{{ incident.alert.source }}</span>
      </p>
      <h2 class="cli-banner-title">{{ incident.alert.title }}</h2>
      <ul class="cli-banner-lines">
        <li v-for="line in incident.alert.lines" :key="line">{{ line }}</li>
      </ul>
      <div
        v-if="mode === 'timed'"
        :class="['cli-countdown', { 'cli-countdown-urgent': urgent }]"
        aria-hidden="true"
      >
        <span class="cli-countdown-fill" :style="{ transform: `scaleX(${fraction})` }"></span>
      </div>
      <p v-if="mode === 'timed'" class="cli-sr-only">
        You have {{ incident.windowSeconds }} seconds for this incident.
      </p>
    </template>
    <p v-else class="cli-banner-idle">No open incident.</p>
  </section>
</template>
