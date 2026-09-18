<script setup>
import PixelIcon from '../components/town/PixelIcon.vue'
</script>
<template>
  <section class="not-found">
    <p class="eyebrow">CASE 404 · A MISSING PAGE</p>
    <img
      src="/images/town/capybara-peach.svg"
      class="mascot-image"
      width="256"
      height="192"
      alt="A friendly pixel-art capybara wearing a peach scarf"
    />
    <h1 tabindex="-1">A little off the trail?</h1>
    <p>
      Even the best detectives take a wrong turn.<br />Let's get you back to your next discovery.
    </p>
    <RouterLink to="/" class="btn btn-primary"
      ><PixelIcon name="arrow" class="icon-back" :size="20" aria-hidden="true" /> Back to
      town</RouterLink
    >
  </section>
</template>
