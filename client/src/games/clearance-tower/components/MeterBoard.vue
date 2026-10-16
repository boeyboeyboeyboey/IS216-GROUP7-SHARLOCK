<script setup>
defineProps({
  breakdown: { type: Array, required: true },
})
</script>

<template>
  <ul class="clear-meters">
    <li v-for="row in breakdown" :key="row.key" class="clear-meter">
      <span class="clear-meter-label">{{ row.label }}</span>
      <progress :value="row.points" :max="row.max" :aria-label="row.label"></progress>
      <span class="clear-number">{{ row.points }} / {{ row.max }}</span>
    </li>
  </ul>
</template>
