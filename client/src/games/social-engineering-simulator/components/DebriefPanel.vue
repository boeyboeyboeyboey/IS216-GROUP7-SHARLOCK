<script setup>
import { computed } from 'vue'

const props = defineProps({
  result: { type: Object, required: true },
  verifierMessages: { type: Array, default: () => [] },
  verifierName: { type: String, default: '' },
})
defineEmits(['restart'])

const outcomeLabel = computed(
  () =>
    ({ resisted: 'Resisted', partial: 'Partly safe', compromised: 'Compromised' })[
      props.result.outcome
    ] ?? props.result.outcome,
)
</script>

<template>
  <section class="soc-debrief" aria-labelledby="soc-debrief-heading">
    <div class="soc-debrief-score">
      <div class="soc-debrief-head" :class="`is-${result.outcome}`">
        <p class="soc-debrief-eyebrow">Debrief &middot; {{ outcomeLabel }}</p>
        <h2 id="soc-debrief-heading">{{ result.score }} / {{ result.maxScore }}</h2>
        <p class="soc-debrief-unsaved">practice &mdash; not saved</p>
      </div>

      <p class="soc-debrief-summary">{{ result.debrief.summary }}</p>

      <h3>Score breakdown</h3>
      <ul class="soc-breakdown">
        <li v-for="item in result.breakdown" :key="item.key">
          <span class="soc-breakdown-label">{{ item.label }}</span>
          <span class="soc-breakdown-points">{{ item.points }} / {{ item.max }}</span>
        </li>
      </ul>
    </div>

    <div class="soc-debrief-story">
      <h3>What happened</h3>
      <p>{{ result.debrief.tactic }}</p>
      <p>{{ result.debrief.saferesponse }}</p>
      <p v-if="result.debrief.note" class="soc-debrief-note">{{ result.debrief.note }}</p>

      <div v-if="verifierMessages.length" class="soc-check">
        <h3>Your check</h3>
        <ul class="soc-check-list">
          <li v-for="(line, index) in verifierMessages" :key="index">
            <strong>{{ line.role === 'you' ? 'You' : verifierName || 'Colleague' }}:</strong>
            {{ line.content }}
          </li>
        </ul>
      </div>

      <button type="button" class="soc-button soc-button-primary" @click="$emit('restart')">
        Try another colleague
      </button>
    </div>
  </section>
</template>
