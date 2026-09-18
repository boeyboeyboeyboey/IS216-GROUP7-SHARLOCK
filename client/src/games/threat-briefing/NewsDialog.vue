<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import CyberNewsCentral from './CyberNewsCentral.vue'
import PixelIcon from '../../components/town/PixelIcon.vue'
import './news.css'

defineEmits(['request-close'])
const dialog = ref(null)
const heading = ref(null)
onMounted(() => {
  dialog.value.showModal()
  heading.value.focus({ preventScroll: true })
})
onBeforeUnmount(() => dialog.value?.close())
</script>
<template>
  <dialog
    id="news-dialog"
    ref="dialog"
    class="news-dialog"
    aria-labelledby="gazette-heading"
    aria-modal="true"
    @cancel.prevent="$emit('request-close')"
    @wheel.self.prevent
    @touchmove.self.prevent
  >
    <div class="gazette-topbar">
      <span><PixelIcon name="news" :size="20" /> THE DAILY BRIEFING</span
      ><button
        type="button"
        class="gazette-button gazette-close"
        aria-label="Close newspaper"
        @click="$emit('request-close')"
      >
        Close <PixelIcon name="close" :size="16" />
      </button>
    </div>
    <header class="gazette-masthead">
      <img
        src="/images/town/capybara-mint.svg"
        width="96"
        height="72"
        alt="Your capybara newsstand vendor"
      />
      <div>
        <p>EXTRA! EXTRA!</p>
        <h1 id="gazette-heading" ref="heading" data-news-heading tabindex="-1">
          The Sharlock Gazette
        </h1>
        <p>Small town. Big stories. Stay curious.</p>
      </div>
      <PixelIcon class="gazette-seal" name="news" :size="52" />
    </header>
    <CyberNewsCentral />
  </dialog>
</template>
