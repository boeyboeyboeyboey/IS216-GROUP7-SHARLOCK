<script setup>
import { WIPE_COLUMNS, WIPE_PHASE_MS, WIPE_ROWS, WIPE_STEP_MS, wipe } from '../pixel-wipe.js'
import '../pixel-wipe.css'

// each block appears (or clears) in one hard step, diagonally from the top-left corner
const cells = Array.from({ length: WIPE_COLUMNS * WIPE_ROWS }, (_, index) => ({
  delay: ((index % WIPE_COLUMNS) + Math.floor(index / WIPE_COLUMNS)) * WIPE_STEP_MS,
}))
const labelDelay = Math.round(WIPE_PHASE_MS * 0.6)
</script>

<template>
  <div
    v-if="wipe.phase !== 'idle'"
    class="pixel-wipe"
    :class="`pixel-wipe--${wipe.phase}`"
    :style="{
      '--wipe-columns': WIPE_COLUMNS,
      '--wipe-rows': WIPE_ROWS,
      '--label-delay': `${labelDelay}ms`,
    }"
  >
    <div class="pixel-wipe__grid" aria-hidden="true">
      <span
        v-for="(cell, index) in cells"
        :key="index"
        class="pixel-wipe__cell"
        :style="{ '--delay': `${cell.delay}ms` }"
      ></span>
    </div>
    <p class="pixel-wipe__label" role="status">Entering Sharlock Town…</p>
  </div>
</template>
