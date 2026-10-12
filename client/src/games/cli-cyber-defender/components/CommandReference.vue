<script setup>
import { COMMAND_TEMPLATES } from '../cliDefender.js'
import CliIcon from './CliIcon.vue'

defineProps({ disabled: { type: Boolean, default: false } })
const emit = defineEmits(['insert-template'])

// keep the command words together and let a trailing placeholder such as <target> wrap below
function parts(label) {
  const [command, ...rest] = label.split(' <')
  return { command, argument: rest.length ? `<${rest.join(' <')}` : '' }
}
</script>

<template>
  <section class="cli-reference" aria-labelledby="cli-reference-heading">
    <h2 id="cli-reference-heading" class="visually-hidden">Command templates</h2>
    <ul class="cli-template-grid">
      <li v-for="item in COMMAND_TEMPLATES" :key="item.id">
        <button
          type="button"
          :class="['btn', 'cli-template', `cli-template-${item.id}`]"
          :disabled="disabled"
          :aria-label="`Insert ${item.label}: ${item.hint}`"
          :title="item.hint"
          @click="emit('insert-template', item.template)"
        >
          <CliIcon :name="item.id" :size="22" />
          <span class="cli-template-text">
            <code class="cli-template-command"
              >{{ parts(item.label).command }}
              <span v-if="parts(item.label).argument" class="cli-template-arg">{{
                parts(item.label).argument
              }}</span></code
            >
            <span class="cli-template-hint">{{ item.hint }}</span>
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>
