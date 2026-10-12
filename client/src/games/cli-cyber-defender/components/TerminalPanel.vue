<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  lines: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  modelValue: { type: String, default: '' },
  history: { type: Array, default: () => [] },
  maxLength: { type: Number, default: 120 },
})
const emit = defineEmits(['submit-command', 'update:modelValue'])

const input = ref(null)
const output = ref(null)
// steps back through earlier commands; -1 means the live draft
const recall = ref(-1)

watch(
  () => props.lines.length,
  async () => {
    await nextTick()
    if (output.value) output.value.scrollTop = output.value.scrollHeight
  },
)

function onKeydown(event) {
  if (!props.history.length) return
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    recall.value = Math.min(recall.value + 1, props.history.length - 1)
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    recall.value = Math.max(recall.value - 1, -1)
  } else return
  emit(
    'update:modelValue',
    recall.value === -1 ? '' : props.history[props.history.length - 1 - recall.value],
  )
}

function onSubmit() {
  recall.value = -1
  emit('submit-command', props.modelValue)
}

defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <section class="cli-terminal" aria-label="Terminal">
    <div
      ref="output"
      class="cli-output"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Terminal output"
      tabindex="0"
    >
      <p v-for="line in lines" :key="line.id" :class="['cli-line', `cli-line-${line.kind}`]">
        {{ line.text }}
      </p>
    </div>
    <form class="cli-prompt" @submit.prevent="onSubmit">
      <label for="cli-command" class="cli-prompt-label">
        <span aria-hidden="true">soc@sharlock:~$</span>
        <span class="cli-sr-only">Command</span>
      </label>
      <input
        id="cli-command"
        ref="input"
        class="cli-input"
        type="text"
        :value="modelValue"
        :maxlength="maxLength"
        :disabled="disabled"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        enterkeyhint="send"
        aria-describedby="cli-command-help"
        @input="emit('update:modelValue', $event.target.value)"
        @keydown="onKeydown"
      />
      <button type="submit" class="cli-button cli-button-primary" :disabled="disabled || busy">
        Run
      </button>
    </form>
    <p id="cli-command-help" class="cli-sr-only">
      Type a command and press Enter. Up and down arrows recall earlier commands.
    </p>
  </section>
</template>
