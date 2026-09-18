<script setup>
import { safeNewsLink } from '../news.js'
defineProps({ nodes: { type: Array, default: () => [] } })
</script>
<template>
  <template v-for="(node, index) in nodes" :key="index">
    <br v-if="node.type === 'break'" />
    <a
      v-else-if="node.type === 'link' && safeNewsLink(node.href)"
      :href="safeNewsLink(node.href)"
      target="_blank"
      rel="noopener noreferrer"
      >{{ node.text }}<span class="visually-hidden"> (opens in a new tab)</span></a
    >
    <template v-else>{{ node.text }}</template>
  </template>
</template>
