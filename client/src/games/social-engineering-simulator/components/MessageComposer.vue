<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  maxLength: { type: Number, default: 1000 },
})
const emit = defineEmits(['send'])

const draft = ref('')
const remaining = computed(() => props.maxLength - draft.value.length)

function submit() {
  const text = draft.value.trim()
  if (!text || props.disabled) return
  emit('send', text)
  draft.value = ''
}

// enter sends, shift+enter inserts a newline
function onKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submit()
  }
}
</script>

<template>
  <form class="soc-composer" @submit.prevent="submit">
    <label class="soc-composer-label" for="soc-composer-input">Your reply</label>
    <textarea
      id="soc-composer-input"
      v-model="draft"
      class="soc-composer-input"
      :maxlength="maxLength"
      :disabled="disabled"
      rows="3"
      placeholder="Type a reply, or ask a question to verify who this is"
      @keydown="onKeydown"
    ></textarea>
    <div class="soc-composer-row">
      <span class="soc-composer-count" aria-live="off">{{ remaining }} characters left</span>
      <button
        type="submit"
        class="soc-button soc-button-primary"
        :disabled="disabled || !draft.trim()"
      >
        Send
      </button>
    </div>
  </form>
</template>
