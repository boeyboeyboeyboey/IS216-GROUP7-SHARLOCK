<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../../services/api.js'
const status = ref('Checking connection…')
const checking = ref(false)
async function checkConnection() {
  if (checking.value) return
  checking.value = true
  status.value = 'Checking connection…'
  try {
    const { data } = await api.get('/health')
    status.value =
      data.status === 'ok'
        ? 'API and database connected.'
        : 'Connection unavailable. Please try again.'
  } catch {
    status.value = 'Connection unavailable. Please try again.'
  } finally {
    checking.value = false
  }
}
onMounted(checkConnection)
</script>
<template>
  <section class="connection-status">
    <h2>Connection check</h2>
    <p role="status" aria-live="polite">{{ status }}</p>
    <button class="btn btn-secondary" type="button" :disabled="checking" @click="checkConnection">
      {{ checking ? 'Checking…' : 'Check connection' }}
    </button>
  </section>
</template>
