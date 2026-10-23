<script setup>
import { ref } from 'vue'
defineProps({ disabled: Boolean, attemptsRemaining: { type: Number, default: 5 } })
const emit = defineEmits(['test-payload'])
const username = ref('')
const password = ref('')
function submit() {
  emit('test-payload', { username: username.value, password: password.value })
  password.value = ''
}
</script>
<template>
  <form class="sql-login" @submit.prevent="submit">
    <div class="sql-form-fields">
      <h2 class="visually-hidden">Customs ledger terminal</h2>
      <p>Fictional fields only. Never enter your Sharlock password.</p>
      <div class="sql-input-grid">
        <div class="sql-input-field">
          <label for="sql-username">Fictional username</label>
          <input
            id="sql-username"
            v-model="username"
            class="form-control"
            maxlength="120"
            autocomplete="off"
            spellcheck="false"
            :disabled="disabled"
          />
        </div>
        <div class="sql-input-field">
          <label for="sql-password">Fictional password</label>
          <input
            id="sql-password"
            v-model="password"
            class="form-control"
            maxlength="120"
            autocomplete="off"
            spellcheck="false"
            :disabled="disabled"
            aria-describedby="sql-password-note"
          />
        </div>
      </div>
      <p id="sql-password-note" class="small">
        Visible so you can inspect the exercise. Cleared after each test.
      </p>
    </div>
    <div class="sql-form-submit">
      <button class="btn btn-primary" :disabled="disabled">Test payload</button>
      <span>{{ attemptsRemaining }} tests remaining</span>
    </div>
  </form>
</template>
