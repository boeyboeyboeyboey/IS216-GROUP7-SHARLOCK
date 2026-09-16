<script setup>
import { onMounted, ref } from 'vue'
import { api } from './services/api.js'

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
  <main class="container py-5">
    <div class="row justify-content-center">
      <div class="col-12 col-md-9 col-lg-7">
        <h1>SHARLOCK</h1>
        <p class="lead">Cybersecurity Game Hub</p>
        <p>Development scaffold. The application screens will be built in the next stage.</p>
        <p role="status" aria-live="polite">{{ status }}</p>
        <button type="button" class="btn btn-primary" :disabled="checking" @click="checkConnection">
          {{ checking ? 'Checking…' : 'Check connection' }}
        </button>
      </div>
    </div>
  </main>
</template>
