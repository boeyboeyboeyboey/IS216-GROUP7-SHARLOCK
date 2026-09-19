<script setup>
import { ref, onBeforeUnmount, watch } from 'vue'
import PixelIcon from './PixelIcon.vue'
const props = defineProps({ suspended: Boolean })
const audio = ref(null)
const isMuted = ref(true)
const starting = ref(false)
const errorMessage = ref('')
let disposed = false
let generation = 0

function failPlayback() {
  if (disposed) return
  if (audio.value) {
    audio.value.muted = true
    audio.value.pause()
  }
  isMuted.value = true
  starting.value = false
  errorMessage.value = 'Sound could not start. Tap to try again.'
}
async function toggleSound() {
  if (!audio.value || starting.value || props.suspended) return
  errorMessage.value = ''
  if (!isMuted.value) {
    audio.value.muted = true
    audio.value.pause()
    isMuted.value = true
    return
  }
  starting.value = true
  const request = ++generation
  audio.value.muted = false
  try {
    // call play within the user gesture; update state only after playback starts
    await audio.value.play()
    if (!disposed && request === generation) isMuted.value = false
  } catch {
    if (request === generation) failPlayback()
  } finally {
    if (!disposed && request === generation) starting.value = false
  }
}
watch(
  () => props.suspended,
  (suspended) => {
    if (suspended) {
      generation++
      // retain the listener's choice while the newspaper temporarily owns the sound
      if (starting.value) isMuted.value = false
      starting.value = false
      if (audio.value) {
        audio.value.muted = true
        audio.value.pause()
      }
    } else if (!isMuted.value) {
      isMuted.value = true
      toggleSound()
    }
  },
)
onBeforeUnmount(() => {
  disposed = true
  if (audio.value) {
    audio.value.muted = true
    audio.value.pause()
  }
})
</script>
<template>
  <div class="town-audio">
    <audio
      ref="audio"
      src="/audio/sharlock-bgm.mp3"
      loop
      muted
      preload="none"
      @error="failPlayback"
    ></audio>
    <button
      class="pixel-button sound-button"
      type="button"
      :aria-label="isMuted ? 'Turn on town sound' : 'Mute town sound'"
      :aria-pressed="!isMuted"
      :disabled="starting || suspended"
      @click="toggleSound"
    >
      <PixelIcon :name="isMuted ? 'mute' : 'sound'" :size="20" /><span>{{
        starting ? 'Starting…' : isMuted ? 'Sound off' : 'Sound on'
      }}</span>
    </button>
    <p v-if="errorMessage" class="audio-error" role="status">{{ errorMessage }}</p>
  </div>
</template>
