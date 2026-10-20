<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

const props = defineProps({
  games: { type: Array, required: true },
  inputPaused: { type: Boolean, default: false },
  // fills its parent instead of sitting in a framed box
  fill: { type: Boolean, default: false },
})
const emit = defineEmits(['enter', 'failed'])

const isDev = import.meta.env.DEV
const returnKey = 'sharlock.hubReturn'
const stage = ref(null)
const pad = ref(null)
const knob = ref(null)
const destList = ref(null)
const view = reactive({
  ready: false,
  failed: false,
  selected: null,
  mode: 'explore',
  engine: null,
  fps: 0,
  drawCalls: 0,
})
let hub = null
let gone = false

const selectedGame = computed(() => props.games.find((game) => game.id === view.selected) ?? null)
// while the hub loads or after it fails, the buttons still lead somewhere
const canEnter = computed(() => Boolean(selectedGame.value) && (!view.ready || view.mode === 'explore'))
// games are covered by the page wipe, so only the newspaper dialog and the first load need the veil
const faded = computed(
  () =>
    (!view.ready && !view.failed) ||
    (view.selected === 'threat-briefing' && (view.mode === 'entering' || view.mode === 'panel')),
)
const status = computed(() => {
  if (view.failed) return '3D view unavailable. Choose a destination below.'
  if (!view.ready) return 'Loading the wharf'
  return isDev ? `Engine ${view.engine}, ${view.fps} fps, ${view.drawCalls} draws` : ''
})

function sync(state) {
  view.ready = state.ready
  view.selected = state.selected
  view.mode = state.mode
  view.engine = state.engine
  view.fps = state.fps
  view.drawCalls = state.drawCalls
}

// choosing the selected destination again deselects it
function choose(id) {
  const next = view.selected === id ? null : id
  view.selected = next
  hub?.select(next)
}

function onEscape() {
  if (props.inputPaused || view.mode !== 'explore' || !view.selected) return
  choose(view.selected)
}

function rememberDoor(id) {
  // the newspaper opens over the hub, so nothing needs restoring after it
  if (id === 'threat-briefing') return
  try {
    sessionStorage.setItem(returnKey, id)
  } catch {
    // storage can be blocked
  }
}

function takeDoor() {
  try {
    const id = sessionStorage.getItem(returnKey)
    sessionStorage.removeItem(returnKey)
    return props.games.some((game) => game.id === id) ? id : null
  } catch {
    return null
  }
}

async function enterSelected() {
  const game = selectedGame.value
  if (!game) return
  rememberDoor(game.id)
  if (view.failed || !hub || !view.ready) {
    emit('enter', game)
    return
  }
  // swoop to the door first, then hand over to the router
  const started = await hub.enter(game.id)
  if (started && !gone) emit('enter', game)
}

function pauseFromProp(value) {
  hub?.pauseInput(value)
  if (value) hub?.back()
}

onMounted(async () => {
  // babylon loads only when the hub mounts, so no other page pays for it
  let createHub
  try {
    ;({ createHub } = await import('./engine.js'))
  } catch (error) {
    console.error('hub engine failed to load', error)
    if (!gone) view.failed = true
    return
  }
  if (gone) return
  // dev overrides (renderer, tier, mirror) only apply outside a production build
  const params = isDev ? new URLSearchParams(location.search) : new URLSearchParams()
  hub = createHub({ container: stage.value, joystick: { el: pad.value, knob: knob.value }, params, spawnAt: takeDoor(), onState: sync })
  if (props.inputPaused) pauseFromProp(true)
  hub.ready.catch(() => {
    if (!gone) view.failed = true
  })
})

onBeforeUnmount(() => {
  gone = true
  hub?.dispose()
  hub = null
})

watch(() => props.inputPaused, pauseFromProp)
watch(
  () => view.failed,
  (failed) => {
    if (failed) emit('failed')
  },
)

defineExpose({
  async focusDestination(id) {
    await nextTick()
    destList.value?.querySelector(`[data-testid="dest-${id}"]`)?.focus()
  },
})
</script>

<template>
  <section
    class="hub-scene"
    :class="{ 'is-fill': fill }"
    aria-label="Thames Wharf"
    @keydown.esc="onEscape"
  >
    <div ref="stage" class="hub-stage"></div>
    <div class="hub-fade" :class="{ on: faded }" aria-hidden="true"></div>
    <div class="hub-hud">
      <slot></slot>
      <p
        class="hub-status"
        data-testid="hub-status"
        role="status"
        :aria-live="isDev ? 'off' : 'polite'"
        :hidden="!status"
      >
        {{ status }}
      </p>
    </div>
    <div class="hub-dock">
      <nav class="hub-dest" aria-label="Destinations">
        <ul ref="destList" class="hub-dest-list">
          <li v-for="game in games" :key="game.id">
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              :data-testid="`dest-${game.id}`"
              :aria-pressed="String(view.selected === game.id)"
              @click="choose(game.id)"
            >
              {{ game.name }}
            </button>
          </li>
        </ul>
      </nav>
      <button
        v-if="selectedGame"
        type="button"
        class="btn btn-primary hub-enter"
        data-testid="enter"
        :disabled="!canEnter"
        @click="enterSelected"
      >
        Enter {{ selectedGame.name }}
      </button>
    </div>
    <div ref="pad" class="hub-joystick" aria-hidden="true"><div ref="knob" class="hub-joystick-knob"></div></div>
  </section>
</template>

<style scoped>
.hub-scene {
  position: relative;
  width: 100%;
  height: min(76dvh, 760px);
  min-height: 420px;
  overflow: hidden;
  border: 3px solid var(--town-edge);
  background: #2a2036;
  box-shadow: var(--shadow-pixel);
}
.hub-stage {
  position: absolute;
  inset: 0;
}
.hub-stage :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  outline: none;
}
.hub-stage :deep(canvas:focus-visible) {
  outline: 3px solid var(--accent-primary);
  outline-offset: -3px;
}
.hub-fade {
  position: absolute;
  inset: 0;
  background: #1b1426;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.45s ease;
}
.hub-fade.on {
  opacity: 0.85;
}
.hub-hud {
  position: absolute;
  top: 8px;
  left: 8px;
  display: grid;
  justify-items: start;
  gap: 8px;
  max-width: calc(100% - 16px);
  pointer-events: none;
}
.hub-hud > :deep(*) {
  pointer-events: auto;
}
.hub-status {
  margin: 0;
  padding: 2px 8px;
  border: 2px solid var(--town-edge);
  background: var(--town-paper);
  font-size: 13px;
}
.hub-status[hidden] {
  display: none;
}
.hub-dock {
  display: contents;
}
.hub-dest {
  position: absolute;
  top: 8px;
  right: 8px;
  max-width: min(260px, calc(100% - 16px));
  max-height: calc(100% - 16px);
  overflow-y: auto;
  padding: 6px;
  border: 2px solid var(--town-edge);
  background: var(--town-paper);
}
.hub-dest-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.hub-dest-list .btn {
  width: 100%;
  text-align: left;
}
.hub-dest-list .btn[aria-pressed='true'] {
  background: var(--accent-primary);
  box-shadow: inset 0 0 0 2px var(--town-edge);
}
.hub-enter {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  max-width: calc(100% - 32px);
}
.hub-joystick {
  position: absolute;
  left: 16px;
  bottom: 16px;
  display: none;
  place-items: center;
  width: 120px;
  height: 120px;
  border: 3px solid var(--town-edge);
  border-radius: 50%;
  background: rgb(255 248 223 / 45%);
  touch-action: none;
}
.hub-joystick-knob {
  width: 52px;
  height: 52px;
  border: 3px solid var(--town-edge);
  border-radius: 50%;
  background: var(--accent-primary);
}
@media (pointer: coarse) {
  .hub-joystick {
    display: grid;
  }
}
@media (max-width: 575.98px) {
  /* destinations and Enter stack along the bottom edge, the HUD sits at the top */
  .hub-dock {
    position: absolute;
    right: 8px;
    bottom: 8px;
    left: 8px;
    display: flex;
    flex-direction: column-reverse;
    gap: 8px;
    pointer-events: none;
  }
  .hub-dest {
    position: static;
    max-width: none;
    max-height: 34dvh;
    padding: 4px;
    pointer-events: auto;
  }
  .hub-dest-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .hub-dest-list .btn {
    min-height: 44px;
    font-size: 13px;
    line-height: 1.2;
  }
  .hub-enter {
    position: static;
    align-self: center;
    min-height: 44px;
    transform: none;
    pointer-events: auto;
  }
  .hub-joystick {
    bottom: auto;
    top: 64px;
    left: 8px;
    width: 96px;
    height: 96px;
  }
}
@media (min-width: 768px) and (min-height: 600px) {
  .hub-scene {
    flex: 1 1 auto;
    height: auto;
  }
}
.hub-scene.is-fill {
  height: 100%;
  min-height: 0;
  border: 0;
  box-shadow: none;
}
@media (prefers-reduced-motion: reduce) {
  .hub-fade {
    transition: none;
  }
}
</style>
