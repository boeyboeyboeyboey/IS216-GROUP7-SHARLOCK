<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import AccessMatrix from './components/AccessMatrix.vue'
import DayControls from './components/DayControls.vue'
import DossierBrief from './components/DossierBrief.vue'
import EventLog from './components/EventLog.vue'
import LabelBoard from './components/LabelBoard.vue'
import LevelDebrief from './components/LevelDebrief.vue'
import LevelSelect from './components/LevelSelect.vue'
import PredictionPanel from './components/PredictionPanel.vue'
import RoleDesigner from './components/RoleDesigner.vue'
import TowerView from './components/TowerView.vue'
import { describeStep } from './clearanceTower.js'
import { useClearanceTower } from './composables/useClearanceTower.js'
import { useDayPlayback } from './composables/useDayPlayback.js'
import './clearance.css'

const {
  phase,
  levels,
  level,
  policy,
  predictions,
  result,
  bestScores,
  pending,
  error,
  allPredicted,
  nextLevelId,
  loadLevels,
  openLevel,
  runDay,
  showPhase,
} = useClearanceTower()

const events = computed(() => result.value?.events ?? [])
const {
  current: currentEvent,
  shown: shownEvents,
  playing,
  finished,
  total,
  speed,
  play,
  pause,
  step,
  skip,
  setSpeed,
} = useDayPlayback(events)
const matrixView = ref('matrix')
const root = ref(null)
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

const showingTower = computed(() => ['design', 'predict', 'day', 'debrief'].includes(phase.value))

// a role needs a name before the server will accept it
const policyReady = computed(() => {
  if (level.value?.model !== 'rbac') return true
  return policy.value.roles.every((role) => role.name.trim().length > 0)
})

// move focus to the new step's heading so keyboard and screen-reader users follow along
watch(phase, async (current) => {
  matrixView.value = 'matrix'
  if (current === 'day' && !reducedMotion) play()
  await nextTick()
  root.value?.querySelector('[data-phase-heading]')?.focus()
})

onMounted(loadLevels)
</script>

<template>
  <div ref="root" class="clearance-game is-fitted">
    <header class="clear-header">
      <RouterLink class="clear-back" to="/">Back to town</RouterLink>
      <h1>Clearance Tower</h1>
      <p class="clear-strap">
        Night shift at the Halcyon Agency. Decide who may see what, then watch the day test your
        policy. Practice only: results are not saved yet.
      </p>
    </header>

    <p v-if="error" class="clear-alert" role="alert">{{ error }}</p>

    <LevelSelect
      v-if="phase === 'levels'"
      :levels="levels"
      :best-scores="bestScores"
      :pending="pending"
      @select="openLevel"
      @reload="loadLevels"
    />

    <DossierBrief
      v-else-if="phase === 'brief'"
      :level="level"
      @begin="showPhase('design')"
      @back="showPhase('levels')"
    />

    <div v-else-if="showingTower" class="clear-workspace">
      <TowerView
        :level="level"
        :policy="policy"
        :current-event="currentEvent"
        :shown-events="shownEvents"
      />

      <div class="clear-desk">
        <section v-if="phase === 'design'" class="clear-card" aria-labelledby="clear-design-title">
          <h2 id="clear-design-title" tabindex="-1" data-phase-heading>
            Policy desk · {{ level.title }}
          </h2>
          <AccessMatrix
            v-if="level.model === 'dac'"
            v-model="policy.grants"
            v-model:view="matrixView"
            :agents="level.agents"
            :files="level.files"
          />
          <LabelBoard
            v-else-if="level.model === 'blp'"
            v-model="policy.objectLabels"
            :files="level.files"
            :clearances="level.clearances"
            :categories="level.categories"
          />
          <RoleDesigner v-else v-model="policy" :level="level" />
          <details class="clear-tasks">
            <summary>Today’s work ({{ level.tasks.length }})</summary>
            <ul>
              <li v-for="task in level.tasks" :key="`${task.agent}-${task.action}-${task.file}`">
                {{ describeStep(level, task) }}
              </li>
            </ul>
          </details>
          <p v-if="!policyReady" class="clear-warning">Give every role a name first.</p>
          <div class="clear-actions">
            <button type="button" class="clear-button" @click="showPhase('brief')">Dossier</button>
            <button
              type="button"
              class="clear-button is-primary"
              :disabled="!policyReady"
              @click="showPhase('predict')"
            >
              Next: predict
            </button>
          </div>
        </section>

        <section
          v-else-if="phase === 'predict'"
          class="clear-card"
          aria-labelledby="clear-predict-title"
        >
          <h2 id="clear-predict-title" tabindex="-1" data-phase-heading>
            Make your calls before the doors open
          </h2>
          <p class="clear-hint">
            Each call is judged on the rules of this case, and correct calls score points.
          </p>
          <PredictionPanel v-model="predictions" :prompts="level.predictions" :disabled="pending" />
          <div class="clear-actions">
            <button type="button" class="clear-button" @click="showPhase('design')">
              Back to policy
            </button>
            <button
              type="button"
              class="clear-button is-primary"
              :disabled="!allPredicted || pending"
              @click="runDay"
            >
              {{ pending ? 'Running…' : 'Run the day' }}
            </button>
          </div>
        </section>

        <section v-else-if="phase === 'day'" class="clear-card" aria-labelledby="clear-day-title">
          <h2 id="clear-day-title" tabindex="-1" data-phase-heading>The day plays out</h2>
          <DayControls
            :playing="playing"
            :finished="finished"
            :position="shownEvents.length"
            :total="total"
            :speed="speed"
            @play="play"
            @pause="pause"
            @step="step"
            @skip="skip"
            @update:speed="setSpeed"
          />
          <EventLog :level="level" :events="shownEvents" />
          <div class="clear-actions">
            <button
              type="button"
              class="clear-button is-primary"
              :disabled="!finished"
              @click="showPhase('debrief')"
            >
              Open the case file
            </button>
          </div>
        </section>

        <LevelDebrief
          v-else
          :level="level"
          :result="result"
          :has-next="Boolean(nextLevelId)"
          @retry="openLevel(level.id)"
          @next="openLevel(nextLevelId)"
          @levels="showPhase('levels')"
        />
      </div>
    </div>
  </div>
</template>
