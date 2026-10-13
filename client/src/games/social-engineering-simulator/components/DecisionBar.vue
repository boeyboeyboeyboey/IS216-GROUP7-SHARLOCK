<script setup>
import { DECISIONS } from '../simulator.js'

defineProps({
  disabled: { type: Boolean, default: false },
})
defineEmits(['decide'])
</script>

<template>
  <section class="soc-decisions" aria-labelledby="soc-decisions-heading">
    <h3 id="soc-decisions-heading">How do you want to end this?</h3>
    <p class="soc-decisions-hint">
      You can decide at any point. Protecting the code and verifying the request is the safe play.
    </p>
    <div class="soc-decisions-row">
      <button
        v-for="decision in DECISIONS"
        :key="decision.id"
        type="button"
        class="soc-button"
        :class="decision.id === 'share-code' ? 'soc-button-danger' : 'soc-button-choice'"
        :disabled="disabled"
        @click="$emit('decide', decision.id)"
      >
        <span class="soc-decision-label">{{ decision.label }}</span>
        <span class="soc-decision-desc">{{ decision.description }}</span>
      </button>
    </div>
  </section>
</template>
