<script setup>
defineOptions({ name: 'SharlockNavbar' })
import { ref } from 'vue'
import PixelIcon from '../town/PixelIcon.vue'
defineProps({
  town: { type: Boolean, default: false },
  menuOpen: { type: Boolean, default: false },
})
defineEmits(['openMenu'])
const menuButton = ref(null)
defineExpose({ focusMenu: () => menuButton.value?.focus() })
</script>
<template>
  <header class="portal-header navbar">
    <RouterLink to="/" class="navbar-brand brand-mark" aria-label="Sharlock Hub home"
      ><img
        src="/images/sharlock-placeholder.svg"
        class="navbar-mascot"
        width="52"
        height="52"
        alt="Sharlock, the 3D-style capybara mascot wearing a monocle"
      /><span class="brand-title d-none d-md-inline">Sharlock Hub</span></RouterLink
    >
    <nav v-if="town" class="town-top-nav d-none d-md-flex" aria-label="Main navigation">
      <RouterLink to="/"><PixelIcon name="map" :size="16" /> Town map</RouterLink
      ><RouterLink to="/profile">Profile</RouterLink><RouterLink to="/progress">Progress</RouterLink
      ><RouterLink to="/leaderboard">Leaderboard</RouterLink>
    </nav>
    <div v-else class="header-note d-none d-xl-flex">
      <span class="tiny-dot"></span> A little curiosity. A safer digital world.
    </div>
    <div class="d-flex align-items-center gap-2">
      <RouterLink v-if="!town" to="/about" class="header-link d-none d-md-inline-flex"
        >Meet Sharlock <PixelIcon name="arrow" :size="16" /></RouterLink
      ><span :class="town ? 'town-preview-tag' : 'preview-tag d-none d-sm-inline-flex'"
        ><PixelIcon v-if="!town" name="star" :size="16" />{{
          town ? 'TOWN PREVIEW' : 'Portal preview'
        }}</span
      ><button
        ref="menuButton"
        class="icon-button mobile-menu d-md-none"
        type="button"
        aria-label="Open navigation and profile"
        aria-controls="portal-menu"
        :aria-expanded="menuOpen"
        @click="$emit('openMenu')"
      >
        <PixelIcon name="menu" :size="24" />
      </button>
    </div>
  </header>
</template>
