<script setup>
import { COMMAND_TEMPLATES } from '../cliDefender.js'

defineProps({
  pending: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['start'])
</script>

<template>
  <section class="cli-panel cli-briefing" aria-labelledby="cli-briefing-heading">
    <h2 id="cli-briefing-heading" class="cli-heading">Shift briefing</h2>
    <p>
      You are the analyst on duty for a fictional company. Eight alerts will arrive one at a time.
      Read each alert, decide what actually needs containing, and type one command to contain it.
    </p>
    <ul class="cli-list">
      <li v-for="item in COMMAND_TEMPLATES" :key="item.id">
        <code>{{ item.label }} &lt;target&gt;</code> &mdash; {{ item.hint }}
      </li>
    </ul>
    <p>
      Alerts include extra details on purpose. Pick the right action <em>and</em> the right target:
      the attacker, the compromised account or the infected machine.
    </p>
    <h3 class="cli-subheading">Scoring</h3>
    <ul class="cli-list">
      <li>A correct command scores 100, then 200, then 300 for each further one in a row.</li>
      <li>A wrong command or a missed window closes that incident and resets your streak.</li>
      <li>A typo does not count against you; the incident stays open. Maximum: 2,100 points.</li>
    </ul>
    <p class="cli-note">
      Timed shift: 8 windows of 10&ndash;15 seconds, 100 seconds in total. Untimed practice has no
      deadlines. Nothing is saved, and no real system is touched.
    </p>
    <p v-if="error" class="cli-alert" role="alert">{{ error }}</p>
    <div class="cli-actions">
      <button
        type="button"
        class="cli-button cli-button-primary"
        :disabled="pending"
        @click="emit('start', 'timed')"
      >
        Start timed shift
      </button>
      <button
        type="button"
        class="cli-button"
        :disabled="pending"
        @click="emit('start', 'practice')"
      >
        Untimed practice (Recommended!)
      </button>
    </div>
    <p v-if="pending" class="cli-note" role="status">Connecting to the terminal&hellip;</p>
  </section>
</template>
