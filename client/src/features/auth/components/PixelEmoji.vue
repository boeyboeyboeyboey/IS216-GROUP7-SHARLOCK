<script setup>
import { onMounted, ref, watch } from 'vue'

// Draws an emoji as chunky 8-bit art: the system emoji is painted onto a tiny canvas, flattened to
// a four-levels-per-channel palette with hard (non-antialiased) edges, then the page scales the
// canvas up with nearest-neighbour. Nothing is fetched; it is decorative and hidden from readers.
const props = defineProps({
  emoji: { type: String, required: true },
  grid: { type: Number, default: 32 },
})

const canvas = ref(null)
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
const LEVELS = 3 // channel values snap to 0, 85, 170, 255

function draw() {
  const context = canvas.value?.getContext?.('2d', { willReadFrequently: true })
  if (!context) return
  const size = props.grid
  context.clearRect(0, 0, size, size)
  context.font = `${Math.round(size * 0.8)}px ${EMOJI_FONT}`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(props.emoji, size / 2, size / 2 + 1)

  const image = context.getImageData(0, 0, size, size)
  const { data } = image
  for (let index = 0; index < data.length; index += 4) {
    // semi-transparent edge pixels are the source of pale fringes, so only solid ones stay
    if (data[index + 3] < 170) {
      data[index + 3] = 0
      continue
    }
    data[index + 3] = 255
    for (let channel = 0; channel < 3; channel += 1) {
      data[index + channel] = Math.round((data[index + channel] / 255) * LEVELS) * (255 / LEVELS)
    }
  }
  context.putImageData(image, 0, 0)
}

onMounted(draw)
watch(() => [props.emoji, props.grid], draw)
</script>

<template>
  <canvas ref="canvas" class="pixel-emoji" :width="grid" :height="grid" aria-hidden="true"></canvas>
</template>
