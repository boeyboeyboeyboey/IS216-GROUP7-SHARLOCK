<script setup>
import { nextTick, ref, watch } from 'vue'
import BriefingPanel from './components/BriefingPanel.vue'
import CommandReference from './components/CommandReference.vue'
import IncidentBanner from './components/IncidentBanner.vue'
import PausedPanel from './components/PausedPanel.vue'
import ScoreHud from './components/ScoreHud.vue'
import ShiftDebrief from './components/ShiftDebrief.vue'
import TerminalPanel from './components/TerminalPanel.vue'
import { MAX_COMMAND_LENGTH } from './cliDefender.js'
import { useCliDefender } from './composables/useCliDefender.js'
import './cli.css'

const {
  phase,
  mode,
  snapshot,
  result,
  lines,
  commandHistory,
  draft,
  pending,
  error,
  current,
  remainingMs,
  paused,
  resuming,
  start,
  resume,
  submit,
  finish,
  endPractice,
  replay,
} = useCliDefender()

const terminal = ref(null)

function insertTemplate(template) {
  draft.value = template
  terminal.value?.focus()
}

watch([phase, paused], async ([next, isPaused]) => {
  if (next !== 'running' || isPaused) return
  await nextTick()
  terminal.value?.focus()
})
</script>

<template>
  <div class="cli-game">
    <div class="cli-intro">
      <RouterLink to="/" class="cli-back"
        ><span aria-hidden="true">&larr;&nbsp;</span>Back to town</RouterLink
      >
      <h1 tabindex="-1">CLI Cyber Defender</h1>
      <p class="cli-strap">
        Contain fictional incidents from a simulated terminal. Every address, account and machine
        here is made up, and no command runs on a real system.
      </p>
    </div>

    <BriefingPanel
      v-if="phase === 'briefing' || phase === 'starting'"
      :pending="phase === 'starting'"
      :error="error"
      @start="start"
    />

    <ShiftDebrief v-else-if="phase === 'debrief' && result" :result="result" @replay="replay" />

    <div v-else class="cli-console">
      <ScoreHud
        :score="snapshot?.score ?? 0"
        :streak="snapshot?.streak ?? 0"
        :multiplier="snapshot?.multiplier ?? 1"
        :remaining-ms="remainingMs"
        :resolved-count="snapshot?.resolvedCount ?? 0"
        :total="snapshot?.incidentCount ?? 8"
        :mode="mode"
      />
      <PausedPanel v-if="paused" :pending="resuming" @resume="resume" />
      <template v-else>
        <IncidentBanner :incident="current" :remaining-ms="remainingMs" :mode="mode" />
        <TerminalPanel
          ref="terminal"
          v-model="draft"
          :lines="lines"
          :history="commandHistory"
          :disabled="phase !== 'running'"
          :busy="pending"
          :max-length="MAX_COMMAND_LENGTH"
          @submit-command="submit"
        />
        <CommandReference :disabled="phase !== 'running'" @insert-template="insertTemplate" />
      </template>
      <p v-if="phase === 'finishing' && !error" class="cli-note" role="status">
        Shift over. Preparing the debrief&hellip;
      </p>
      <div v-if="error" class="cli-alert" role="alert">
        <p>{{ error }}</p>
        <button v-if="phase === 'finishing'" type="button" class="cli-button" @click="finish">
          Retry debrief
        </button>
      </div>
      <div class="cli-actions">
        <button
          v-if="mode === 'practice' && phase === 'running'"
          type="button"
          class="cli-button"
          :disabled="pending"
          @click="endPractice"
        >
          End practice
        </button>
        <span class="cli-badge"
          >{{ mode === 'practice' ? 'Untimed practice' : 'Timed shift' }} &middot; not saved</span
        >
      </div>
    </div>
  </div>
</template>
