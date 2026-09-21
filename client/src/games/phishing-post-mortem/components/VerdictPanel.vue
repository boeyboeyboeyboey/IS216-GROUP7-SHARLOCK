<script setup>
import { computed } from 'vue'

const props = defineProps({
  selectedEmailId: { type: String, default: '' },
  selectedSubject: { type: String, default: '' },
  evidenceOptions: { type: Array, required: true },
  selectedEvidenceIds: { type: Array, required: true },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update-evidence', 'submit-verdict'])

const full = computed(() => props.selectedEvidenceIds.length >= 2)
const ready = computed(() => Boolean(props.selectedEmailId) && full.value && !props.disabled)

function toggle(id) {
  const next = props.selectedEvidenceIds.includes(id)
    ? props.selectedEvidenceIds.filter((value) => value !== id)
    : [...props.selectedEvidenceIds, id]
  emit('update-evidence', next)
}
</script>

<template>
  <section class="sharmail-verdict" aria-labelledby="phish-verdict-heading">
    <h3 id="phish-verdict-heading">Your verdict</h3>
    <p class="sharmail-verdict-target">
      <span class="sharmail-verdict-label">Patient Zero</span>
      <strong v-if="selectedEmailId">{{ selectedSubject }}</strong>
      <em v-else>Open a message and choose Accuse this message.</em>
    </p>
    <fieldset class="sharmail-evidence" :disabled="disabled">
      <legend>Supporting evidence - choose exactly two</legend>
      <label v-for="option in evidenceOptions" :key="option.id" class="sharmail-evidence-option">
        <input
          type="checkbox"
          :checked="selectedEvidenceIds.includes(option.id)"
          :disabled="full && !selectedEvidenceIds.includes(option.id)"
          @change="toggle(option.id)"
        />
        <span>{{ option.label }}</span>
      </label>
      <p v-if="full" class="sharmail-evidence-hint">
        Two clues chosen. Clear one to pick a different clue.
      </p>
    </fieldset>
    <button
      type="button"
      class="sharmail-submit"
      :disabled="!ready"
      @click="$emit('submit-verdict')"
    >
      Submit final verdict
    </button>
    <p class="sharmail-verdict-note">
      One verdict per case. The evidence chain is revealed after you submit.
    </p>
  </section>
</template>
