<script setup>
defineOptions({ name: 'SharlockDashboard' })
import TownMap from '../components/town/TownMap.vue'
import PixelIcon from '../components/town/PixelIcon.vue'
import { gameCatalog } from '../data/gameCatalog.js'
import { previewProfile } from '../data/portalPreview.js'
</script>
<template>
  <div class="town-dashboard">
    <section class="town-intro">
      <div>
        <p class="town-eyebrow">A SMALL TOWN. A WORLD OF DISCOVERIES.</p>
        <h1 tabindex="-1">Welcome to Sharlock Town.</h1>
        <p>Pick a building. Follow your curiosity. Every adventure is open.</p>
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
    <TownMap class="town-canvas" :games="gameCatalog" />
    <p class="town-footnote">
      <PixelIcon name="star" :size="16" /> A place to explore at your own pace. Activities currently
      open as previews; points are illustrative.
    </p>
  </div>
</template>
