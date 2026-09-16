<script setup>
import { PhBinoculars, PhArrowLeft } from '@phosphor-icons/vue'
defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  showMascot: { type: Boolean, default: false },
})
</script>
<template>
  <section class="coming-soon">
    <img
      v-if="showMascot"
      class="mascot-image auth-mascot"
      src="/images/sharlock-placeholder.svg"
      width="220"
      height="208"
      alt="Sharlock, a friendly 3D-style capybara wearing a sleuthing monocle, welcoming you to the hub; artwork placeholder"
    />
    <span v-else class="coming-soon-icon"
      ><PhBinoculars :size="64" weight="duotone" aria-hidden="true"
    /></span>
    <p class="eyebrow">ON THE HORIZON</p>
    <h1 tabindex="-1">{{ title }}</h1>
    <p>{{ description }}</p>
    <p class="preview-notice">
      This feature is being prepared. The portal currently uses sample data.
    </p>
    <RouterLink to="/dashboard" class="btn btn-primary"
      ><PhArrowLeft :size="19" aria-hidden="true" /> Explore the town</RouterLink
    >
  </section>
</template>
