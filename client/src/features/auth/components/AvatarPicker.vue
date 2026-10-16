<script setup>
import { avatarPresets } from '../avatars.js'

defineProps({
  selected: { type: String, default: 'mint' },
  disabled: { type: Boolean, default: false },
})
defineEmits(['update:selected'])
</script>

<template>
  <fieldset class="auth-avatar-picker" :disabled="disabled">
    <legend>Choose your capybara</legend>
    <p class="auth-field-hint">Pick one portrait. You can recognize your account by this avatar.</p>
    <div class="auth-avatar-picker__grid">
      <label
        v-for="preset in avatarPresets"
        :key="preset.id"
        class="auth-avatar-choice"
        :class="{ 'is-selected': selected === preset.id }"
        :for="`auth-avatar-${preset.id}`"
      >
        <input
          :id="`auth-avatar-${preset.id}`"
          class="auth-avatar-choice__input"
          type="radio"
          name="avatarId"
          :value="preset.id"
          :checked="selected === preset.id"
          @change="$emit('update:selected', preset.id)"
        />
        <img :src="preset.path" width="64" height="64" :alt="`${preset.label} capybara avatar`" />
        <span>{{ preset.label }}</span>
      </label>
    </div>
  </fieldset>
</template>
