<script setup>
import { PhArrowLeft } from '@phosphor-icons/vue'
</script>
<template>
  <section class="not-found">
    <p class="eyebrow">CASE 404 · A MISSING PAGE</p>
    <img
      src="/images/sharlock-placeholder.svg"
      class="mascot-image"
      width="260"
      height="246"
      alt="Sharlock, a friendly 3D-style capybara detective with a monocle, looking for a missing page; artwork placeholder"
    />
    <h1 tabindex="-1">A little off the trail?</h1>
    <p>
      Even the best detectives take a wrong turn.<br />Let's get you back to your next discovery.
    </p>
    <RouterLink to="/dashboard" class="btn btn-primary"
      ><PhArrowLeft :size="20" aria-hidden="true" /> Back to town</RouterLink
    >
  </section>
</template>
