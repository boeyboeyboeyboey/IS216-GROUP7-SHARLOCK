<script setup>
import { computed } from 'vue'
import { describeStep, formatLabel, MODEL_GUIDES } from '../clearanceTower.js'

const props = defineProps({
  level: { type: Object, required: true },
})
const emit = defineEmits(['begin', 'back'])

const guide = computed(() => MODEL_GUIDES[props.level.model])
</script>

<template>
  <section class="clear-card clear-dossier" aria-labelledby="clear-brief-title">
    <p class="clear-eyebrow">Act {{ level.act }} · {{ level.actTitle }}</p>
    <h2 id="clear-brief-title" tabindex="-1" data-phase-heading>{{ level.title }}</h2>
    <p class="clear-brief">{{ level.brief }}</p>

    <div class="clear-dossier-grid">
      <div>
        <h3>The rules: {{ guide.name }}</h3>
        <ul>
          <li v-for="rule in guide.rules" :key="rule">{{ rule }}</li>
        </ul>
      </div>
      <div>
        <h3>On shift</h3>
        <ul>
          <li v-for="agent in level.agents" :key="agent.id">
            <strong>{{ agent.name }}</strong
            >, {{ agent.title }}
            <span v-if="agent.label" class="clear-tag">{{ formatLabel(level, agent.label) }}</span>
          </li>
        </ul>
      </div>
      <div>
        <h3>Today’s work</h3>
        <ul>
          <li v-for="task in level.tasks" :key="`${task.agent}-${task.action}-${task.file}`">
            {{ describeStep(level, task) }}
          </li>
        </ul>
      </div>
    </div>

    <p class="clear-source">Source: {{ level.slides }}</p>
    <div class="clear-actions">
      <button type="button" class="clear-button" @click="emit('back')">All cases</button>
      <button type="button" class="clear-button is-primary" @click="emit('begin')">
        Open the policy desk
      </button>
    </div>
  </section>
</template>
