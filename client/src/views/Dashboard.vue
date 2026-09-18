<script setup>
defineOptions({ name: 'SharlockDashboard' })
import { nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TownMap from '../components/town/TownMap.vue'
import PixelIcon from '../components/town/PixelIcon.vue'
import { gameCatalog } from '../data/gameCatalog.js'
import { previewProfile } from '../data/portalPreview.js'
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
      <RouterLink to="/profile" class="town-player" aria-label="View sample detective profile">
        <img
          src="/images/town/capybara-mint.svg"
          width="80"
          height="60"
          alt="2D pixel-art capybara avatar with a mint scarf"
        />
        <span
          ><strong>{{ previewProfile.title }}</strong
          ><span
            ><PixelIcon name="star" :size="16" /> {{ previewProfile.points }} points
            <small>· Sample</small></span
          ></span
        >
      </RouterLink>
    </section>
    <TownMap
      ref="townMap"
      class="town-canvas"
      :games="gameCatalog"
      @activate="router.push($event)"
    />
    <p class="town-footnote">
      <PixelIcon name="star" :size="16" /> A place to explore at your own pace. Read the Gazette or
      explore the activity previews; points are illustrative.
    </p>
    <RouterView @request-close="closeNewspaper" />
  </div>
</template>
