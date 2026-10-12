<script setup>
import { computed } from 'vue'

const props = defineProps({ concepts: { type: Object, default: null } })

const tags = computed(() => {
  if (!props.concepts) return []
  const { attack, cia = [], stage } = props.concepts
  return [
    attack && { kind: 'attack', label: attack },
    ...cia.map((item) => ({ kind: 'cia', label: `${item} at risk` })),
    stage && { kind: 'stage', label: stage },
  ].filter(Boolean)
})
</script>

<template>
  <ul v-if="tags.length" class="cli-tags" aria-label="Security concepts">
    <li v-for="tag in tags" :key="tag.label" :class="['cli-tag', `cli-tag-${tag.kind}`]">
      {{ tag.label }}
    </li>
  </ul>
</template>
