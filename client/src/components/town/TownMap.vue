<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { TOWN_SIZE } from '../../data/gameCatalog.js'
import PixelIcon from './PixelIcon.vue'
import TownScenery from './TownScenery.vue'
import TownAudio from './TownAudio.vue'
import GameInfoCard from './GameInfoCard.vue'

const props = defineProps({ games: { type: Array, required: true } })
const frame = ref(null)
const viewport = ref(null)
const infoCard = ref(null)
const selectedId = ref(null)
const selectedGame = computed(() => props.games.find((game) => game.id === selectedId.value))
const cardStyle = ref({ left: '12px', bottom: '12px' })
const buildingButtons = new Map()
let pinned = false
let ignoreFocus = false
let pointerDown = false
let closeTimer
let resizeObserver

function cancelClose() {
  clearTimeout(closeTimer)
}
function placeCard() {
  const button = buildingButtons.get(selectedId.value)
  const card = infoCard.value?.$el
  if (!button || !frame.value || !card) return
  if (frame.value.clientWidth < 640) {
    cardStyle.value = { left: '12px', right: '12px', bottom: '12px' }
    return
  }
  // Keep hover cards inside the visible map, independent of its scroll position.
  const bounds = frame.value.getBoundingClientRect()
  const anchor = button.getBoundingClientRect()
  const width = card.offsetWidth
  const height = card.offsetHeight
  let left = anchor.right - bounds.left + 10
  if (left + width > bounds.width - 12) left = anchor.left - bounds.left - width - 10
  left = Math.max(12, Math.min(left, bounds.width - width - 12))
  const top = Math.max(12, Math.min(anchor.top - bounds.top, bounds.height - height - 12))
  cardStyle.value = { left: `${left}px`, top: `${top}px` }
}
async function reveal(game, pin = false) {
  if (ignoreFocus || (pinned && !pin)) return
  cancelClose()
  pinned = pin
  selectedId.value = game.id
  await nextTick()
  placeCard()
  if (pin) infoCard.value?.focus()
}
function dismiss(restoreFocus = false) {
  cancelClose()
  const button = buildingButtons.get(selectedId.value)
  selectedId.value = null
  pinned = false
  if (restoreFocus) {
    ignoreFocus = true
    button?.focus({ preventScroll: true })
    ignoreFocus = false
  }
}
function scheduleClose() {
  if (pinned) return
  cancelClose()
  closeTimer = setTimeout(() => dismiss(), 180)
}
function focusLeft(event) {
  if (!frame.value?.contains(event.relatedTarget) && !pinned) dismiss()
}
function pointerReveal(event, game) {
  if (event.pointerType === 'mouse') reveal(game)
}
function focusReveal(game) {
  // Touch focuses before click. Opening the overlay then can steal that same tap.
  if (!pointerDown) reveal(game)
}
function selectBuilding(game) {
  pointerDown = false
  reveal(game, true)
}
async function findBuilding(event) {
  const game = props.games.find((item) => item.id === event.target.value)
  if (!game) return
  viewport.value.scrollTo({
    left: game.building.x - (viewport.value.clientWidth - 192) / 2,
    top: game.building.y - 80,
    behavior: 'instant',
  })
  await reveal(game, true)
}
function panWithKeyboard(event) {
  if (event.target !== viewport.value) return
  const offsets = {
    ArrowLeft: [-64, 0],
    ArrowRight: [64, 0],
    ArrowUp: [0, -64],
    ArrowDown: [0, 64],
  }
  if (!offsets[event.key]) return
  event.preventDefault()
  viewport.value.scrollBy({
    left: offsets[event.key][0],
    top: offsets[event.key][1],
    behavior: 'instant',
  })
}
onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(placeCard)
    resizeObserver.observe(frame.value)
  }
})
onBeforeUnmount(() => {
  cancelClose()
  resizeObserver?.disconnect()
})
</script>

<template>
  <section class="town-map" aria-label="Explore Sharlock Town">
    <div class="map-toolbar">
      <div class="map-location">
        <PixelIcon name="map" :size="22" /><span
          >SHARLOCK TOWN<small>All {{ games.length }} activities open</small></span
        >
      </div>
      <TownAudio />
    </div>
    <div
      ref="frame"
      class="map-frame"
      @pointerleave="scheduleClose"
      @focusout="focusLeft"
      @keydown.esc.stop.prevent="dismiss(true)"
    >
      <div
        ref="viewport"
        class="town-viewport"
        tabindex="0"
        role="region"
        aria-label="Scrollable town map"
        aria-describedby="map-instructions"
        @scroll="placeCard"
        @keydown="panWithKeyboard"
        @pointerdown.self="dismiss()"
      >
        <div
          class="town-world"
          :style="{ width: `${TOWN_SIZE.width}px`, height: `${TOWN_SIZE.height}px` }"
        >
          <TownScenery />
          <ul class="town-buildings" aria-label="Game buildings">
            <li
              v-for="game in games"
              :key="game.id"
              class="town-building"
              :style="{ left: `${game.building.x}px`, top: `${game.building.y}px` }"
            >
              <button
                :ref="
                  (element) =>
                    element
                      ? buildingButtons.set(game.id, element)
                      : buildingButtons.delete(game.id)
                "
                type="button"
                class="building-button"
                :class="{ 'building-selected': selectedId === game.id }"
                :aria-label="`Explore ${game.name}`"
                :aria-expanded="selectedId === game.id"
                :aria-controls="selectedId === game.id ? `game-card-${game.id}` : undefined"
                @pointerenter="pointerReveal($event, game)"
                @pointerleave="scheduleClose"
                @pointerdown="pointerDown = true"
                @pointercancel="pointerDown = false"
                @blur="pointerDown = false"
                @focus="focusReveal(game)"
                @click="selectBuilding(game)"
              >
                <img
                  class="building-sprite"
                  :src="`/images/town/${game.building.type}.svg`"
                  width="160"
                  height="160"
                  :alt="`2D pixel-art ${game.building.type} for ${game.name}`"
                /><span class="building-name">{{ game.name }}</span
                ><span class="building-hint">SELECT TO EXPLORE</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
      <GameInfoCard
        v-if="selectedGame"
        ref="infoCard"
        :game="selectedGame"
        :style="cardStyle"
        @close="dismiss(true)"
        @pointerenter="cancelClose"
        @pointerleave="scheduleClose"
      />
    </div>
    <div class="map-controls">
      <p id="map-instructions">
        <span class="map-key">↔ ↕</span> Scroll or swipe to explore. Select any building.
      </p>
      <label for="find-building"
        >Jump to
        <select id="find-building" :value="selectedId || ''" @change="findBuilding">
          <option value="">Choose a building</option>
          <option v-for="game in games" :key="game.id" :value="game.id">{{ game.name }}</option>
        </select></label
      >
    </div>
  </section>
</template>
