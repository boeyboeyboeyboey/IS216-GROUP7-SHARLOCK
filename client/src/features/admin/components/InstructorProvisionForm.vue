<script setup>
import { ref } from 'vue'
import AvatarPicker from '../../auth/components/AvatarPicker.vue'

defineProps({
  pending: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['provision'])
const email = ref('')
const username = ref('')
const avatarId = ref('mint')

function provision() {
  emit('provision', {
    email: email.value,
    username: username.value,
    avatarId: avatarId.value,
  })
}

function resetForm() {
  email.value = ''
  username.value = ''
  avatarId.value = 'mint'
}

defineExpose({ resetForm })
</script>

<template>
  <section class="admin-workspace__panel" aria-labelledby="provision-instructor-title">
    <p class="admin-workspace__eyebrow">STAFF ACCESS</p>
    <h2 id="provision-instructor-title">Provision an instructor</h2>
    <p class="admin-workspace__intro">
      The instructor will choose a password through a private, single-use activation link.
    </p>
    <p v-if="error" class="admin-workspace__alert" role="alert">{{ error }}</p>

    <form class="admin-workspace__form" @submit.prevent="provision">
      <label for="admin-instructor-email">Instructor email</label>
      <input
        id="admin-instructor-email"
        v-model="email"
        type="email"
        name="email"
        autocomplete="email"
        maxlength="254"
        required
        :disabled="pending"
      />
      <label for="admin-instructor-username">Instructor username</label>
      <input
        id="admin-instructor-username"
        v-model="username"
        name="username"
        autocomplete="off"
        minlength="3"
        maxlength="32"
        aria-describedby="admin-instructor-username-hint"
        required
        :disabled="pending"
      />
      <small id="admin-instructor-username-hint">
        Use 3–32 letters, numbers, underscores or hyphens.
      </small>
      <AvatarPicker v-model:selected="avatarId" :disabled="pending" />
      <button class="admin-workspace__button" type="submit" :disabled="pending">
        {{ pending ? 'Preparing private link…' : 'Create instructor and activation link' }}
      </button>
    </form>
  </section>
</template>
