<script setup>
defineOptions({ name: 'SharlockProfile' })
import PixelIcon from '../components/town/PixelIcon.vue'
import { gameCatalog } from '../data/gameCatalog.js'
import TrophyCase from '../components/portal/TrophyCase.vue'
import GlobalProgressBar from '../components/portal/GlobalProgressBar.vue'
import {
  previewProfile,
  previewAchievements,
  previewCompletedGameIds,
} from '../data/portalPreview.js'
</script>
<template>
  <div class="profile-view">
    <p class="eyebrow">YOUR DETECTIVE DESK</p>
    <h1 tabindex="-1">A curious mind looks good on you.</h1>
    <p class="page-description">
      A little collection of everything you've discovered along the way.
    </p>
    <p class="preview-notice">
      Sample profile, points, and badges for this portal preview. Personal records will appear here
      when accounts are available.
    </p>
    <section class="profile-overview" aria-label="Sample profile">
      <div class="large-avatar">
        <img
          :src="previewProfile.avatar"
          class="avatar-image"
          width="144"
          height="144"
          alt="Sample avatar: a pixel-art capybara wearing a mint scarf"
        />
      </div>
      <div>
        <span class="title-pill">{{ previewProfile.title }}</span>
        <h2>{{ previewProfile.username }}</h2>
        <p>Always looking for the next clue.</p>
        <span class="points-pill"
          ><PixelIcon name="star" :size="20" aria-hidden="true" /> {{ previewProfile.points }} total
          points</span
        >
      </div>
      <RouterLink to="/" class="btn btn-secondary"
        >Town map <PixelIcon name="arrow" :size="18" aria-hidden="true"
      /></RouterLink>
    </section>
    <GlobalProgressBar :completed="previewCompletedGameIds.length" :total="gameCatalog.length" />
    <TrophyCase :achievements="previewAchievements" />
  </div>
</template>
