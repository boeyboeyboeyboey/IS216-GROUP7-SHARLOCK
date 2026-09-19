<script setup>
import { ref } from 'vue'
defineProps({ activeTab: { type: String, required: true } })
defineEmits(['update:tab'])
const tabs = [
  { id: 'news', label: 'Latest news' },
  { id: 'owasp', label: 'OWASP Top 10' },
]
const buttons = ref([])
function moveFocus(event, index) {
  const target = {
    ArrowRight: (index + 1) % tabs.length,
    ArrowLeft: (index + tabs.length - 1) % tabs.length,
    Home: 0,
    End: tabs.length - 1,
  }[event.key]
  if (target === undefined) return
  event.preventDefault()
  buttons.value[target]?.focus()
}
</script>
<template>
  <div class="gazette-tabs" role="tablist" aria-label="Sharlock Times sections">
    <button
      v-for="(tab, index) in tabs"
      :id="`times-tab-${tab.id}`"
      :key="tab.id"
      :ref="(element) => (buttons[index] = element)"
      type="button"
      role="tab"
      class="gazette-button"
      :aria-selected="activeTab === tab.id"
      :aria-controls="`times-panel-${tab.id}`"
      :tabindex="activeTab === tab.id ? 0 : -1"
      @keydown="moveFocus($event, index)"
      @click="$emit('update:tab', tab.id)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
