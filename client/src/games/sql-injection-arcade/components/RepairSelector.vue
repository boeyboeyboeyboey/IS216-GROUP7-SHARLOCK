<script setup>
import { onMounted, ref } from 'vue'
defineProps({ options: { type: Array, default: () => [] }, disabled: Boolean })
const emit = defineEmits(['select-repair'])
const selected = ref('')
const heading = ref(null)
onMounted(() => heading.value?.focus({ preventScroll: true }))
</script>
<template>
  <form @submit.prevent="emit('select-repair', selected)">
    <fieldset :disabled="disabled">
      <legend ref="heading" tabindex="-1">Seal the breach</legend>
      <div class="sql-form-fields">
        <p>Choose the change that keeps user data from becoming query code. One scored choice.</p>
        <div class="sql-repair-grid">
          <label v-for="option in options" :key="option.id" class="sql-repair-option">
            <input v-model="selected" type="radio" name="sql-repair" :value="option.id" required />
            {{ option.label }}
          </label>
        </div>
      </div>
      <div class="sql-form-submit">
        <button class="btn btn-primary" :disabled="!selected || disabled">Confirm repair</button>
      </div>
    </fieldset>
  </form>
</template>
