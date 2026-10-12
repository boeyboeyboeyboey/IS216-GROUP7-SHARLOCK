<script setup>
import { computed } from 'vue'

const props = defineProps({
  score: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  multiplier: { type: Number, default: 1 },
  remainingMs: { type: Number, default: null },
  resolvedCount: { type: Number, default: 0 },
  total: { type: Number, default: 8 },
  mode: { type: String, default: 'timed' },
})

const timeLabel = computed(() =>
  props.mode === 'practice' || props.remainingMs == null
    ? 'untimed'
    : `${(props.remainingMs / 1000).toFixed(1)}s`,
)
</script>

<template>
  <dl class="cli-hud" aria-label="Shift status">
    <div>
      <dt>Score</dt>
      <dd>{{ score.toLocaleString() }}</dd>
    </div>
    <div>
      <dt>Streak</dt>
      <dd>
        {{ streak }} <span class="cli-hud-sub">(next &times;{{ multiplier }})</span>
      </dd>
    </div>
    <div>
      <dt>Window</dt>
      <dd aria-hidden="true">{{ timeLabel }}</dd>
    </div>
    <div>
      <dt>Handled</dt>
      <dd>{{ resolvedCount }} / {{ total }}</dd>
    </div>
  </dl>
</template>
