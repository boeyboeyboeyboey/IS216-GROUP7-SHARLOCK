<script setup>
import { ref, useId } from 'vue'
import PixelIcon from '../town/PixelIcon.vue'
defineProps({ text: { type: String, required: true } })
const open = ref(false)
const dismissed = ref(false)
const id = useId()
function toggle() {
  open.value = !open.value
  dismissed.value = !open.value
}
function dismiss() {
  open.value = false
  dismissed.value = true
}
</script>

<template>
  <span
    class="sharlock-tip"
    :class="{ 'tip-dismissed': dismissed }"
    @mouseleave="dismiss"
    @keydown.esc.stop="dismiss"
  >
    <button
      type="button"
      class="icon-button tip-trigger"
      aria-label="Tip from Sharlock"
      :aria-describedby="id"
      @mouseenter="dismissed = false"
      @focus="dismissed = false"
      @blur="dismiss"
      @click="toggle"
    >
      <PixelIcon name="question" :size="22" aria-hidden="true" />
    </button>
    <span :id="id" role="tooltip" class="tip-bubble" :class="{ 'is-open': open }"
      ><img
        src="/images/town/capybara-blue.svg"
        class="mascot-image tip-mascot"
        width="64"
        height="48"
        alt="A pixel-art capybara wearing a blue scarf, offering a clue"
      /><span
        ><strong>Sharlock's clue</strong><span>{{ text }}</span></span
      ></span
    >
  </span>
</template>
