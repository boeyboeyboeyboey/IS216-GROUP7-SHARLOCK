<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { DEMO_SCENES } from '../cliDefender.js'
import CliIcon from './CliIcon.vue'

const props = defineProps({ typeMs: { type: Number, default: 60 } })

const index = ref(0)
const typed = ref('')
const stage = ref('alert')
const scene = computed(() => DEMO_SCENES[index.value])
let timers = []
let observer
let visible = true
const root = ref(null)

function later(callback, ms) {
  timers.push(setTimeout(callback, ms))
}

// each scene: show the alert, type the command a character at a time, confirm, move on
function play() {
  timers.forEach(clearTimeout)
  timers = []
  typed.value = ''
  stage.value = 'alert'
  later(() => {
    stage.value = 'typing'
    typeFrom(0)
  }, 900)
}

function typeFrom(position) {
  const { command } = scene.value
  typed.value = command.slice(0, position)
  if (position < command.length) {
    later(() => typeFrom(position + 1), props.typeMs)
    return
  }
  later(() => {
    stage.value = 'done'
    later(() => {
      index.value = (index.value + 1) % DEMO_SCENES.length
      play()
    }, 1700)
  }, 300)
}

function stop() {
  timers.forEach(clearTimeout)
  timers = []
}

// only animate while the demo is on screen and the tab is visible
function sync() {
  if (visible && !document.hidden) {
    if (!timers.length) play()
  } else stop()
}

onMounted(() => {
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    typed.value = scene.value.command
    stage.value = 'done'
    return
  }
  document.addEventListener('visibilitychange', sync)
  if (globalThis.IntersectionObserver && root.value) {
    observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      sync()
    })
    observer.observe(root.value)
  }
  play()
})

onBeforeUnmount(() => {
  stop()
  observer?.disconnect()
  document.removeEventListener('visibilitychange', sync)
})
</script>

<template>
  <figure ref="root" class="cli-demo">
    <div class="cli-demo-window" aria-hidden="true">
      <div class="cli-demo-bar">
        <span></span><span></span><span></span>
        <strong>demo</strong>
      </div>
      <div :key="index" class="cli-demo-body">
        <p class="cli-demo-alert"><CliIcon name="alert" :size="14" />{{ scene.alert }}</p>
        <p class="cli-demo-prompt">
          <span class="cli-demo-host">soc@sharlock:~$</span>
          <span class="cli-demo-typed">{{ typed }}</span
          ><span v-if="stage !== 'done'" class="cli-demo-caret">_</span>
        </p>
        <p v-if="stage === 'done'" class="cli-demo-ok">
          <CliIcon name="check" :size="16" />{{ scene.result }}
        </p>
      </div>
      <div class="cli-demo-steps">
        <span
          v-for="(item, position) in DEMO_SCENES"
          :key="item.command"
          :class="{ 'is-active': position === index }"
        ></span>
      </div>
    </div>
    <figcaption class="visually-hidden">
      Demo: an alert appears, the analyst types one command, and the incident is contained.
    </figcaption>
  </figure>
</template>
