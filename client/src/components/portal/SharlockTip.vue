<script setup>
import { ref, useId } from 'vue'
import { PhQuestion } from '@phosphor-icons/vue'
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
      <PhQuestion :size="22" weight="duotone" aria-hidden="true" />
    </button>
    <span :id="id" role="tooltip" class="tip-bubble" :class="{ 'is-open': open }"
      ><img
        src="/images/sharlock-placeholder.svg"
        class="mascot-image tip-mascot"
        width="64"
        height="64"
        alt="Sharlock, a friendly 3D-style capybara with a sleuthing monocle, offering a clue; artwork placeholder"
      /><span
        ><strong>Sharlock's clue</strong><span>{{ text }}</span></span
      ></span
    >
  </span>
</template>
