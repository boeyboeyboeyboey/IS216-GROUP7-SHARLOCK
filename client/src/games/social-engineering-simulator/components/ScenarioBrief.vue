<script setup>
defineProps({
  brief: { type: Object, required: true },
  persona: { type: Object, required: true },
})
defineEmits(['start'])
</script>

<template>
  <section class="soc-brief" aria-labelledby="soc-brief-heading">
    <p class="soc-brief-eyebrow">Simulated workplace chat &middot; fictional</p>
    <h2 id="soc-brief-heading">{{ brief.title }}</h2>
    <p class="soc-brief-persona">
      You are about to be contacted by <strong>{{ persona.displayName }}</strong
      >.
    </p>
    <p class="soc-brief-objective">{{ brief.objective }}</p>
    <ul class="soc-brief-rules">
      <li>The reset code on your screen is a secret. Treat it like a password.</li>
      <li>You have up to {{ brief.turnBudget }} replies. Stay calm and ask questions.</li>
      <li>Everyone and everything here is fictional. Nothing you type touches a real account.</li>
    </ul>
    <button type="button" class="soc-button soc-button-primary" @click="$emit('start')">
      Begin the conversation
    </button>
  </section>
</template>
