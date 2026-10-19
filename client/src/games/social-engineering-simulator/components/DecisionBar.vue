<script setup>
import { computed } from 'vue'
import { DECISIONS } from '../simulator.js'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  hideVerify: { type: Boolean, default: false },
  colleagueName: { type: String, default: '' },
  colleagueRole: { type: String, default: '' },
  resetCode: { type: String, default: '' },
})
defineEmits(['decide'])

// first letters of the first two words, e.g. "Marcus Tan" -> "MT"
const colleagueInitials = computed(() =>
  props.colleagueName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join(''),
)
</script>

<template>
  <section
    class="soc-decisions"
    :class="{ 'is-compact': hideVerify }"
    aria-labelledby="soc-decisions-heading"
  >
    <div v-if="resetCode" class="soc-code-card">
      <p class="soc-code-card-label">Your reset code</p>
      <code class="soc-code" data-testid="soc-reset-code-chat">{{ resetCode }}</code>
    </div>
    <h3 id="soc-decisions-heading">How do you want to end this?</h3>
    <p v-if="!hideVerify" class="soc-decisions-hint">
      You can decide at any point. Check who is really asking before you decide.
    </p>
    <div v-if="hideVerify && colleagueName" class="soc-colleague-card">
      <span class="soc-colleague-avatar" aria-hidden="true">{{ colleagueInitials }}</span>
      <div class="soc-colleague-text">
        <p class="soc-colleague-label">Your colleague</p>
        <p class="soc-colleague-name">{{ colleagueName }}</p>
        <p v-if="colleagueRole" class="soc-colleague-role">{{ colleagueRole }}</p>
      </div>
    </div>
    <div class="soc-decisions-row">
      <button
        v-for="decision in hideVerify
          ? DECISIONS.filter((item) => item.id !== 'verify-independently')
          : DECISIONS"
        :key="decision.id"
        type="button"
        class="soc-button"
        :class="decision.id === 'share-code' ? 'soc-button-danger' : 'soc-button-choice'"
        :disabled="disabled"
        @click="$emit('decide', decision.id)"
      >
        <span class="soc-decision-label">{{ decision.label }}</span>
        <span class="soc-decision-desc">{{ decision.description }}</span>
        <span v-if="decision.note" class="soc-decision-note">{{ decision.note }}</span>
      </button>
    </div>
  </section>
</template>
