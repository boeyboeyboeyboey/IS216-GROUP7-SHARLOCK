<script setup>
import { onMounted, ref } from 'vue'
import CliIcon from './CliIcon.vue'

defineProps({ pending: { type: Boolean, default: false } })
const emit = defineEmits(['resume'])

const button = ref(null)

onMounted(() => button.value?.focus())
</script>

<template>
  <section class="cli-panel cli-paused" aria-labelledby="cli-paused-heading">
    <h2 id="cli-paused-heading" class="cli-heading">
      <CliIcon name="pause" :size="22" /> Game paused
    </h2>
    <p>Too quick for you? Take a breather. Security Analysts don't get breaks though!</p>
    <div class="d-flex flex-wrap gap-3 mt-3">
      <button
        ref="button"
        type="button"
        class="btn cli-btn-primary"
        :disabled="pending"
        @click="emit('resume')"
      >
        <CliIcon name="play" :size="18" />Resume game
      </button>
    </div>
  </section>
</template>
