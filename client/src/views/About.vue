<script setup>
defineOptions({ name: 'SharlockAbout' })
import ConnectionStatus from '../components/portal/ConnectionStatus.vue'
</script>
<template>
  <div class="about-view">
    <p class="eyebrow">A LITTLE ABOUT US</p>
    <h1 tabindex="-1">Meet your curious companion.</h1>
    <p class="page-description">
      Sharlock turns introductory cybersecurity into a trail of small investigations. Explore
      encryption, integrity, permissions, and defensive thinking with a friendly capybara by your
      side.
    </p>
    <div class="about-details">
      <h2>Made for learning</h2>
      <p>
        Built by Boey, Keane, Eric, Russell, Xin Lei, and Athithya for WAD2. Our aim is to make
        foundational concepts easier to apply through interactive, controlled exercises.
      </p>
      <p class="preview-notice">
        You're exploring the portal design preview. The sample points and badges are illustrative;
        accounts, saved results, and playable games are still being developed.
      </p>
    </div>
    <ConnectionStatus />
  </div>
</template>
