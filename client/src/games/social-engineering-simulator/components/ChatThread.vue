<script setup>
defineProps({
  messages: { type: Array, required: true },
  pending: { type: Boolean, default: false },
  personaName: { type: String, default: 'Colleague' },
})
</script>

<template>
  <div class="soc-thread" role="log" aria-label="Conversation" aria-live="polite">
    <ol class="soc-thread-list">
      <li
        v-for="(message, index) in messages"
        :key="index"
        class="soc-message"
        :class="message.role === 'you' ? 'is-you' : 'is-colleague'"
      >
        <span class="soc-message-author">{{ message.role === 'you' ? 'You' : personaName }}</span>
        <p class="soc-message-body">{{ message.content }}</p>
      </li>
    </ol>
    <p v-if="pending" class="soc-typing" role="status">{{ personaName }} is replying&hellip;</p>
  </div>
</template>
