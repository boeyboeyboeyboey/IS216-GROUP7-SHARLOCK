<script setup>
import { computed } from 'vue'

const props = defineProps({
  levels: { type: Array, required: true },
  bestScores: { type: Object, default: () => ({}) },
  pending: { type: Boolean, default: false },
})
const emit = defineEmits(['select', 'reload'])

const acts = computed(() => {
  const groups = []
  props.levels.forEach((level, index) => {
    let act = groups.find((group) => group.number === level.act)
    if (!act) {
      act = { number: level.act, title: level.actTitle, levels: [] }
      groups.push(act)
    }
    act.levels.push({ ...level, number: index + 1 })
  })
  return groups
})
</script>

<template>
  <section class="clear-card" aria-labelledby="clear-levels-title">
    <h2 id="clear-levels-title" tabindex="-1" data-phase-heading>Choose a case</h2>
    <p>
      Six cases across three access-control models. Play them in any order; nothing is timed. Each
      case: read the dossier, set the policy, predict a few decisions, then run the day.
    </p>
    <p v-if="!levels.length && !pending">
      <button type="button" class="clear-button" @click="emit('reload')">Load the cases</button>
    </p>
    <div v-for="act in acts" :key="act.number" class="clear-act">
      <h3>Act {{ act.number }} · {{ act.title }}</h3>
      <ul class="clear-level-list">
        <li v-for="level in act.levels" :key="level.id">
          <button
            type="button"
            class="clear-button clear-level-button"
            :disabled="pending"
            @click="emit('select', level.id)"
          >
            <span class="clear-level-number">Case {{ level.number }}</span>
            <span class="clear-level-title">{{ level.title }}</span>
            <span v-if="bestScores[level.id] !== undefined" class="clear-level-best">
              Best <span class="clear-number">{{ bestScores[level.id] }}</span> / 100
            </span>
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>
