<script setup>
import { VERDICTS } from '../clearanceTower.js'

const props = defineProps({
  prompts: { type: Array, required: true },
  modelValue: { type: Object, required: true },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

function choose(promptId, verdict) {
  emit('update:modelValue', { ...props.modelValue, [promptId]: verdict })
}
</script>

<template>
  <div class="clear-predictions">
    <fieldset v-for="(prompt, index) in prompts" :key="prompt.id" class="clear-prediction">
      <legend>
        <span class="clear-eyebrow">Call {{ index + 1 }}</span>
        {{ prompt.request }}
      </legend>
      <p class="clear-context">{{ prompt.context }}</p>
      <div class="clear-verdicts">
        <label
          v-for="verdict in VERDICTS"
          :key="verdict.value"
          class="clear-verdict"
          :class="{ 'is-chosen': modelValue[prompt.id] === verdict.value }"
        >
          <input
            type="radio"
            :name="`prediction-${prompt.id}`"
            :value="verdict.value"
            :checked="modelValue[prompt.id] === verdict.value"
            :disabled="disabled"
            @change="choose(prompt.id, verdict.value)"
          />
          {{ verdict.label }}
        </label>
      </div>
    </fieldset>
  </div>
</template>
