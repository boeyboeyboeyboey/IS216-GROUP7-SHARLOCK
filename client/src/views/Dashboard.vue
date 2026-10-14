<script setup>
defineOptions({ name: 'SharlockDashboard' })
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TownMap from '../components/town/TownMap.vue'
import PixelIcon from '../components/town/PixelIcon.vue'
import { gameCatalog } from '../data/gameCatalog.js'
import { useAuthStore } from '../features/auth/store.js'
import { avatarFor } from '../features/auth/avatars.js'
const auth = useAuthStore()
const avatar = computed(() => avatarFor(auth.user?.avatarId))
const route = useRoute()
const router = useRouter()
const townMap = ref(null)
let openedFromTown = false
watch(
  () => route.name,
  async (name, previous) => {
    if (name === 'news') {
      openedFromTown = previous === 'town'
      townMap.value?.dismiss()
    } else if (name === 'town' && previous === 'news') {
      openedFromTown = false
      await nextTick()
      townMap.value?.focusBuilding('threat-briefing')
    }
  },
)
function closeNewspaper() {
  // only go back when this mounted town created the newspaper history entry
  if (openedFromTown) router.back()
  else router.replace({ name: 'town' })
}
</script>
<template>
  <div class="town-dashboard">
    <section class="town-intro">
      <div>
        <p class="town-eyebrow">A SMALL TOWN. A WORLD OF DISCOVERIES.</p>
        <h1 tabindex="-1">Welcome to Sharlock Town.</h1>
        <p>
          Pick a building. Follow your curiosity. Every adventure is open.
          <RouterLink to="/about">About Sharlock</RouterLink>
        </p>
      </div>
      <RouterLink to="/profile" class="town-player" aria-label="View your detective profile">
        <img :src="avatar.path" width="80" height="80" :alt="avatar.label" class="avatar-image" />
        <span
          ><strong>{{ auth.user?.username }}</strong
          ><span>Results are not saved</span></span
        >
      </RouterLink>
    </section>
    <TownMap
      ref="townMap"
      class="town-canvas"
      :games="gameCatalog"
      :sound-suspended="route.name === 'news'"
      @activate="router.push($event)"
    />
    <p class="town-footnote">
      <PixelIcon name="star" :size="16" /> Explore at your own pace. Your account is saved; game
      results and learning progress are not saved yet.
    </p>
    <RouterView @request-close="closeNewspaper" />
  </div>
</template>
