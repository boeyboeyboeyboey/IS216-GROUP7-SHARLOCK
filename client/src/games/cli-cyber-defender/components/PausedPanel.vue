<script setup>
import { onMounted, ref } from 'vue'

defineProps({ pending: { type: Boolean, default: false } })
const emit = defineEmits(['resume'])

const button = ref(null)

onMounted(() => button.value?.focus())
</script>

<template>
  <section class="cli-panel cli-paused" aria-labelledby="cli-paused-heading">
    <h2 id="cli-paused-heading" class="cli-heading">Shift paused</h2>
    <p>
      You switched away from the game, so the clock stopped. The current alert is hidden until you
      resume, and your time left on it is kept.
    </p>
    <div class="cli-actions">
      <button
        ref="button"
        type="button"
        class="cli-button cli-button-primary"
        :disabled="pending"
        @click="emit('resume')"
      >
        Resume shift
      </button>
    </div>
  </section>
</template>
