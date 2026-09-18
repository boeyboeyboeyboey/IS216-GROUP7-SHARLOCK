<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
const props = defineProps({
  section: { type: String, required: true },
  range: { type: String, required: true },
  query: { type: String, default: '' },
  loading: Boolean,
  canRefresh: Boolean,
})
defineEmits(['update:section', 'update:range', 'update:query', 'refresh'])
const media = window.matchMedia('(min-width: 768px)')
const expanded = ref(media.matches || Boolean(props.query) || props.range === 'month')
function resizeTools(event) {
  expanded.value = event.matches
}
onMounted(() => media.addEventListener('change', resizeTools))
onBeforeUnmount(() => media.removeEventListener('change', resizeTools))
</script>
<template>
  <div class="gazette-filters">
    <div class="gazette-sections" role="group" aria-label="Newspaper section">
      <button
        v-for="item in ['cybersecurity', 'technology']"
        :key="item"
        type="button"
        class="gazette-button"
        :aria-pressed="section === item"
        @click="$emit('update:section', item)"
      >
        {{ item === 'cybersecurity' ? 'Cybersecurity' : 'Technology' }}
      </button>
    </div>
    <details class="gazette-browse" :open="expanded" @toggle="expanded = $event.target.open">
      <summary>
        Browse &amp; search <span>{{ range === 'week' ? '· Seven days' : '· 30 days' }}</span>
      </summary>
      <div class="gazette-tools">
        <label
          >Edition<select :value="range" @change="$emit('update:range', $event.target.value)">
            <option value="week">Past seven days</option>
            <option value="month">Older stories · past 30 days</option>
          </select></label
        >
        <label class="gazette-search"
          >Search this edition<input
            type="search"
            :value="query"
            maxlength="80"
            placeholder="Try passwords or privacy"
            @input="$emit('update:query', $event.target.value)"
        /></label>
        <button
          type="button"
          class="gazette-button"
          :disabled="!canRefresh"
          @click="$emit('refresh')"
        >
          {{ loading ? 'Checking…' : 'Check for updates' }}
        </button>
      </div>
    </details>
  </div>
</template>
