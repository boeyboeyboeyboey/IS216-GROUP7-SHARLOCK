<script setup>
defineProps({ page: { type: Number, required: true }, pageCount: { type: Number, required: true } })
defineEmits(['update:page'])
</script>
<template>
  <nav v-if="pageCount > 1" class="gazette-pagination" aria-label="Newspaper pages">
    <button
      type="button"
      class="gazette-button"
      :disabled="page === 1"
      aria-label="Previous newspaper page"
      @click="$emit('update:page', page - 1)"
    >
      ← Previous
    </button>
    <button
      v-for="number in pageCount"
      :key="number"
      type="button"
      class="gazette-button gazette-page"
      :aria-current="page === number ? 'page' : undefined"
      :aria-label="`Newspaper page ${number}`"
      @click="$emit('update:page', number)"
    >
      {{ number }}
    </button>
    <button
      type="button"
      class="gazette-button"
      :disabled="page === pageCount"
      aria-label="Next newspaper page"
      @click="$emit('update:page', page + 1)"
    >
      Next →
    </button>
  </nav>
</template>
