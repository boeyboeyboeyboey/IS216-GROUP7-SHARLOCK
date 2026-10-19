<script setup>
defineProps({
  playing: { type: Boolean, default: false },
  finished: { type: Boolean, default: false },
  position: { type: Number, required: true },
  total: { type: Number, required: true },
  speed: { type: Number, default: 1 },
})
const emit = defineEmits(['play', 'pause', 'step', 'skip', 'update:speed'])

const SPEEDS = [1, 2]
</script>

<template>
  <div class="clear-day-controls" role="group" aria-label="Day playback">
    <button v-if="playing" type="button" class="clear-button" @click="emit('pause')">Pause</button>
    <button v-else type="button" class="clear-button" :disabled="finished" @click="emit('play')">
      Play
    </button>
    <button type="button" class="clear-button" :disabled="finished" @click="emit('step')">
      Next event
    </button>
    <button type="button" class="clear-button" :disabled="finished" @click="emit('skip')">
      Skip to end
    </button>
    <label class="clear-field clear-speed">
      <span>Speed</span>
      <select :value="speed" @change="emit('update:speed', Number($event.target.value))">
        <option v-for="option in SPEEDS" :key="option" :value="option">{{ option }}×</option>
      </select>
    </label>
    <p class="clear-progress" aria-live="polite">
      Event <span class="clear-number">{{ position }}</span> of
      <span class="clear-number">{{ total }}</span>
    </p>
  </div>
</template>
