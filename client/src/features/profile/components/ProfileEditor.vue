<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import AvatarPicker from '../../auth/components/AvatarPicker.vue'

const props = defineProps({
  profile: { type: Object, required: true },
  draft: { type: Object, default: null },
  pending: { type: Boolean, default: false },
  error: { type: Object, default: null },
})
const emit = defineEmits(['save', 'cancel', 'draft-change'])

const username = ref(props.draft?.username ?? props.profile.username)
const avatarId = ref(props.draft?.avatarId ?? props.profile.avatarId)
const localError = ref('')
const usernameInput = ref(null)

watch([username, avatarId], () => {
  emit('draft-change', { username: username.value, avatarId: avatarId.value })
})

onMounted(async () => {
  await nextTick()
  usernameInput.value?.focus()
})

function validateUsername(value) {
  const trimmed = value.trim()
  return /^[a-z0-9_-]{3,32}$/i.test(trimmed) ? trimmed : null
}

function submit() {
  const validUsername = validateUsername(username.value)
  if (!validUsername) {
    localError.value = 'Use 3 to 32 letters, numbers, underscores or hyphens.'
    usernameInput.value?.focus()
    return
  }
  localError.value = ''
  emit('save', { username: validUsername, avatarId: avatarId.value })
}
</script>

<template>
  <form class="profile-editor" aria-label="Edit profile" @submit.prevent="submit">
    <div class="profile-editor__field">
      <label for="profile-username">Username</label>
      <input
        id="profile-username"
        ref="usernameInput"
        v-model="username"
        type="text"
        autocomplete="username"
        autocapitalize="none"
        spellcheck="false"
        maxlength="32"
        required
        :disabled="pending"
        :aria-invalid="Boolean(localError || error?.fieldErrors?.username)"
        aria-describedby="profile-username-hint profile-username-error"
      />
      <small id="profile-username-hint">3–32 letters, numbers, underscores or hyphens.</small>
      <p
        v-if="localError || error?.fieldErrors?.username"
        id="profile-username-error"
        class="profile-editor__field-error"
      >
        {{ localError || error.fieldErrors.username }}
      </p>
    </div>

    <AvatarPicker v-model:selected="avatarId" :disabled="pending" />
    <p v-if="error?.fieldErrors?.avatarId" class="profile-editor__field-error">
      {{ error.fieldErrors.avatarId }}
    </p>

    <p v-if="error && !error.fieldErrors?.username && !error.fieldErrors?.avatarId" role="alert">
      {{ error.message }}
    </p>
    <div class="profile-editor__actions">
      <button class="btn btn-primary" type="submit" :disabled="pending">
        {{ pending ? 'Saving…' : 'Save changes' }}
      </button>
      <button class="btn btn-secondary" type="button" :disabled="pending" @click="emit('cancel')">
        Cancel
      </button>
    </div>
    <p v-if="pending" class="profile-editor__status" role="status">Saving your profile…</p>
  </form>
</template>
