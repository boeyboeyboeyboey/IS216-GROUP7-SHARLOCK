<script setup>
import { computed } from 'vue'
import { PhFlagCheckered } from '@phosphor-icons/vue'
const props = defineProps({
  completed: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
})
const totalCount = computed(() =>
  Number.isFinite(props.total) ? Math.max(0, Math.floor(props.total)) : 0,
)
const completedCount = computed(() =>
  Number.isFinite(props.completed)
    ? Math.min(totalCount.value, Math.max(0, Math.floor(props.completed)))
    : 0,
)
const percentage = computed(() =>
  totalCount.value ? Math.round((completedCount.value / totalCount.value) * 100) : 0,
)
</script>

<template>
  <section class="curriculum-progress" aria-label="Curriculum progress">
    <PhFlagCheckered class="progress-icon" weight="duotone" :size="27" aria-hidden="true" />
    <div class="flex-grow-1 min-width-0">
      <div class="d-flex justify-content-between gap-3 mb-2">
        <span class="small"
          >Your learning journey
          <span class="progress-count">· {{ completedCount }} of {{ totalCount }} cases</span></span
        ><strong class="small">{{ percentage }}%</strong>
      </div>
      <div
        class="progress"
        role="progressbar"
        aria-label="Curriculum completion"
        :aria-valuenow="percentage"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div class="progress-bar" :style="{ width: `${percentage}%` }"></div>
      </div>
    </div>
  </section>
</template>
