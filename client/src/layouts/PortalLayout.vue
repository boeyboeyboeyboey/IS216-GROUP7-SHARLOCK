<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import Offcanvas from 'bootstrap/js/dist/offcanvas'
import ProfileWidget from '../components/portal/ProfileWidget.vue'
import Navbar from '../components/portal/Navbar.vue'
import PixelIcon from '../components/town/PixelIcon.vue'
import { previewProfile } from '../data/portalPreview.js'

const route = useRoute()
const panel = ref(null)
const navbar = ref(null)
const isTown = computed(() => route.meta.theme === 'town')
const menuOpen = ref(false)
let offcanvas
let media
let routeChanged = false
const navigation = [
  { to: '/', label: 'Town map', icon: 'map' },
  { to: '/profile', label: 'Detective profile', icon: 'trophy' },
  { to: '/progress', label: 'Learning progress', icon: 'chart' },
  { to: '/leaderboard', label: 'Cohort leaderboard', icon: 'people' },
]
function openMenu() {
  offcanvas?.show()
}
function closeMenu() {
  offcanvas?.hide()
}
function showState() {
  menuOpen.value = true
}
function hideState() {
  menuOpen.value = false
}
function focusPage() {
  const heading = route.meta.newsDialog ? '[data-news-heading]' : 'main h1'
  document.querySelector(heading)?.focus({ preventScroll: true })
}
function onHidden() {
  if (routeChanged || media.matches) focusPage()
  else navbar.value?.focusMenu()
  routeChanged = false
}
function onBreakpoint(event) {
  if (event.matches) closeMenu()
}
onMounted(() => {
  offcanvas = new Offcanvas(panel.value)
  media = window.matchMedia('(min-width: 768px)')
  media.addEventListener('change', onBreakpoint)
  panel.value.addEventListener('show.bs.offcanvas', showState)
  panel.value.addEventListener('hide.bs.offcanvas', hideState)
  panel.value.addEventListener('hidden.bs.offcanvas', onHidden)
})
watch(
  () => route.fullPath,
  async (_path, previousPath) => {
    if (menuOpen.value) {
      routeChanged = true
      closeMenu()
    } else if (
      !route.meta.newsDialog &&
      !(route.name === 'town' && previousPath?.split(/[?#]/)[0] === '/games/threat-briefing')
    ) {
      await nextTick()
      focusPage()
    }
  },
)
onBeforeUnmount(() => {
  media?.removeEventListener('change', onBreakpoint)
  panel.value?.removeEventListener('show.bs.offcanvas', showState)
  panel.value?.removeEventListener('hide.bs.offcanvas', hideState)
  panel.value?.removeEventListener('hidden.bs.offcanvas', onHidden)
  offcanvas?.dispose()
})
</script>

<template>
  <div
    class="portal-shell"
    :class="{ 'is-town': isTown, 'is-utility': route.meta.theme === 'utility' }"
  >
    <a href="#main-content" class="skip-link">Skip to content</a>
    <Navbar ref="navbar" :town="isTown" :menu-open="menuOpen" @open-menu="openMenu" />
    <aside
      id="portal-menu"
      ref="panel"
      class="portal-sidebar offcanvas-md offcanvas-start"
      tabindex="-1"
      aria-labelledby="menu-title"
    >
      <div class="offcanvas-header">
        <h2 id="menu-title" class="h5 mb-0">Your detective desk</h2>
        <button type="button" class="icon-button" aria-label="Close navigation" @click="closeMenu">
          <PixelIcon name="close" :size="24" />
        </button>
      </div>
      <div class="offcanvas-body">
        <div v-if="isTown" class="town-menu-profile">
          <img
            src="/images/town/capybara-mint.svg"
            width="96"
            height="72"
            alt="2D pixel-art capybara avatar wearing a mint scarf"
          />
          <p>{{ previewProfile.username }}</p>
          <span>{{ previewProfile.title }}</span
          ><strong>{{ previewProfile.points }} points</strong><small>Sample profile</small>
        </div>
        <ProfileWidget v-else v-bind="previewProfile" />
        <p class="nav-caption">YOUR EXPLORER'S KIT</p>
        <nav class="nav flex-column portal-nav" aria-label="Main navigation">
          <RouterLink v-for="item in navigation" :key="item.to" :to="item.to" class="nav-link"
            ><PixelIcon :name="item.icon" :size="20" />{{ item.label
            }}<span class="active-nav-dot" aria-hidden="true"></span
          ></RouterLink>
        </nav>
        <div v-if="!isTown" class="sidebar-note">
          <PixelIcon name="star" :size="24" />
          <p>Every expert starts<br />with a little curiosity.</p>
          <span>You've got this, detective.</span>
        </div>
        <RouterLink to="/about" class="sidebar-about"
          >What is Sharlock? <PixelIcon name="arrow" :size="16"
        /></RouterLink>
      </div>
    </aside>
    <div class="portal-workspace">
      <main id="main-content" class="portal-main" tabindex="-1"><RouterView /></main>
      <footer class="portal-footer">
        <span>Made for curious minds.</span><span>SHARLOCK · WAD2</span>
      </footer>
    </div>
  </div>
</template>
