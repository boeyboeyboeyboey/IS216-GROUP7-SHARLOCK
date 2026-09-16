<script setup>
import { computed } from 'vue'
const props = defineProps({
  name: { type: String, default: 'star' },
  size: { type: Number, default: 20 },
})
const shapes = {
  star: 'M7 0h2v3h2v2h5v2h-2v2h-2v3h1v4h-3v-2H6v2H3v-4h1V9H2V7H0V5h5V3h2Z',
  sound: 'M1 6h3V4h2V2h3v12H6v-2H4v-2H1Zm10-2h2v2h2v4h-2v2h-2v-2h2V6h-2Z',
  mute: 'M1 6h3V4h2V2h3v12H6v-2H4v-2H1Zm10-1h2v2h2V5h1v2h-1v2h1v2h-1V9h-2v2h-2V9h2V7h-2Z',
  close:
    'M2 2h2v2H2Zm2 2h2v2H4Zm2 2h4v4H6Zm4 4h2v2h-2Zm2 2h2v2h-2Zm0-10h2v2h-2Zm-2 2h2v2h-2ZM4 10h2v2H4Zm-2 2h2v2H2Z',
  menu: 'M1 2h14v2H1Zm0 5h14v2H1Zm0 5h14v2H1Z',
  arrow: 'M7 1h3v3h3v3h3v2h-3v3h-3v3H7v-3h3V9H0V7h10V4H7Z',
  map: 'M1 2h4v2h6V2h4v12h-4v-2H5v2H1Zm2 2v8h2V4Zm4 2v4h2V6Zm4-2v8h2V4Z',
  trophy: 'M3 1h10v2h3v6h-3v2h-3v2h3v2H3v-2h3v-2H3V9H0V3h3Zm-1 4v2h1V5Zm11 0v2h1V5Z',
}
const path = computed(() => shapes[props.name] || shapes.star)
</script>
<template>
  <svg
    class="pixel-icon"
    :width="size"
    :height="size"
    viewBox="0 0 16 16"
    fill="currentColor"
    shape-rendering="crispEdges"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="path" />
  </svg>
</template>
