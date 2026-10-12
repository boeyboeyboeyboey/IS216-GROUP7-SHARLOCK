<script setup>
import { COMMAND_TEMPLATES } from '../cliDefender.js'

defineProps({ disabled: { type: Boolean, default: false } })
const emit = defineEmits(['insert-template'])
</script>

<template>
  <section class="cli-reference" aria-labelledby="cli-reference-heading">
    <h2 id="cli-reference-heading" class="cli-subheading">Command reference</h2>
    <p class="cli-note">Tap a command to start typing it, then add the target from the alert.</p>
    <ul class="cli-template-list">
      <li v-for="item in COMMAND_TEMPLATES" :key="item.id">
        <button
          type="button"
          class="cli-button cli-template"
          :disabled="disabled"
          :aria-label="`Insert ${item.label}: ${item.hint}`"
          @click="emit('insert-template', item.template)"
        >
          <code>{{ item.label }}</code>
          <span class="cli-template-hint">{{ item.hint }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>
