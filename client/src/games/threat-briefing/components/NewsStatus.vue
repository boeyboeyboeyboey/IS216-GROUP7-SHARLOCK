<script setup>
import { newsDate } from '../news.js'
defineProps({
  loading: Boolean,
  error: { type: String, default: '' },
  stale: Boolean,
  partial: Boolean,
  fetchedAt: { type: String, default: '' },
  refreshAvailableAt: { type: Number, default: 0 },
  canRefresh: Boolean,
})
defineEmits(['retry'])
</script>
<template>
  <div class="gazette-status" role="status" aria-live="polite" aria-atomic="true">
    <p v-if="loading">The capybara is checking the news desk…</p>
    <p v-else-if="error">
      {{ error }}
      <button type="button" class="gazette-button" :disabled="!canRefresh" @click="$emit('retry')">
        Try again
      </button>
    </p>
    <p v-else-if="stale">
      A cached edition · check for a fresh update. Last successful update:
      {{ newsDate(fetchedAt, true) }} SGT
    </p>
    <p v-else-if="fetchedAt">Edition checked {{ newsDate(fetchedAt, true) }} SGT</p>
    <p v-if="partial">Some stories could not be included in this edition.</p>
    <small v-if="!loading && !canRefresh && refreshAvailableAt"
      >Next update check available {{ newsDate(refreshAvailableAt, true) }} SGT</small
    >
  </div>
</template>
