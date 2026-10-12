<script setup>
import { computed, onMounted, ref } from 'vue'

const props = defineProps({ result: { type: Object, required: true } })
const emit = defineEmits(['replay'])

const heading = ref(null)
const OUTCOME_LABELS = {
  correct: 'OK',
  wrong: 'WRONG',
  missed: 'MISSED',
  skipped: 'SKIPPED',
}
const modeLabel = computed(() =>
  props.result.mode === 'practice' ? 'Untimed practice' : 'Timed shift',
)

onMounted(() => heading.value?.focus())
</script>

<template>
  <section class="cli-panel cli-debrief" aria-labelledby="cli-debrief-heading">
    <h2 id="cli-debrief-heading" ref="heading" class="cli-heading" tabindex="-1">Shift debrief</h2>
    <p class="cli-score">
      <strong>{{ result.score.toLocaleString() }}</strong> / {{ result.maxScore.toLocaleString() }}
      points
    </p>
    <p>{{ result.feedback.summary }} Best streak: {{ result.result.bestStreak }}.</p>
    <p class="cli-note">{{ modeLabel }} &middot; practice result, not saved.</p>

    <h3 class="cli-subheading">Topics</h3>
    <ul class="cli-list">
      <li v-for="topic in result.topicOutcomes" :key="topic.topic">
        {{ topic.label }}: {{ topic.achieved ? 'all handled correctly' : 'needs another look' }}
      </li>
    </ul>

    <h3 class="cli-subheading">Incident by incident</h3>
    <ol class="cli-debrief-list">
      <li v-for="item in result.debrief" :key="item.incidentId" class="cli-debrief-item">
        <p class="cli-debrief-title">
          <span :class="['cli-outcome', `cli-outcome-${item.outcome}`]">
            {{ OUTCOME_LABELS[item.outcome] }}
          </span>
          {{ item.title }}
          <span v-if="item.pointsAwarded" class="cli-hud-sub">+{{ item.pointsAwarded }}</span>
        </p>
        <p>
          Your command: <code>{{ item.yourCommand ?? 'none' }}</code>
        </p>
        <p>
          Correct response: <code>{{ item.expectedCommand }}</code>
        </p>
        <p class="cli-note">{{ item.explanation }}</p>
      </li>
    </ol>

    <div class="cli-actions">
      <button type="button" class="cli-button cli-button-primary" @click="emit('replay')">
        Play again
      </button>
      <RouterLink to="/" class="cli-button">Back to town</RouterLink>
    </div>
  </section>
</template>
