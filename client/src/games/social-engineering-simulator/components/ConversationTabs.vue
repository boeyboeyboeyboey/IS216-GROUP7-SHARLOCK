<script setup>
import { nextTick, ref } from 'vue'

const props = defineProps({
  tabs: { type: Array, required: true },
  activeId: { type: String, required: true },
})
const emit = defineEmits(['select'])

const buttons = ref([])

// arrow keys move both selection and focus (roving tabindex)
async function onKeydown(event, index) {
  const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
  if (!step) return
  event.preventDefault()
  const next = (index + step + props.tabs.length) % props.tabs.length
  emit('select', props.tabs[next].id)
  await nextTick()
  buttons.value[next]?.focus()
}
</script>

<template>
  <div class="soc-tabs" role="tablist" aria-label="Conversations">
    <button
      v-for="(tab, index) in tabs"
      :key="tab.id"
      ref="buttons"
      type="button"
      role="tab"
      class="soc-tab"
      :class="{ 'is-active': tab.id === activeId }"
      :aria-selected="tab.id === activeId ? 'true' : 'false'"
      :tabindex="tab.id === activeId ? 0 : -1"
      @click="emit('select', tab.id)"
      @keydown="onKeydown($event, index)"
    >
      {{ tab.label }}
      <span v-if="tab.unread > 0" class="soc-tab-badge"
        ><span aria-hidden="true">{{ tab.unread }}</span
        ><span class="soc-tab-badge-sr"> new</span></span
      >
    </button>
  </div>
</template>
