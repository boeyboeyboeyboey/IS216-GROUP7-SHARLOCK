<script setup>
defineProps({
  memberships: { type: Array, default: () => [] },
  pendingIds: { type: Object, default: () => ({}) },
  status: { type: String, default: 'pending' },
  page: { type: Number, default: 1 },
  total: { type: Number, default: 0 },
  busy: { type: Boolean, default: false },
  recoveryAllowed: { type: Boolean, default: false },
})
defineEmits(['approve', 'reject', 'remove', 'page', 'recover'])
</script>

<template>
  <section class="cohort-panel" aria-label="Class members">
    <p v-if="memberships.length === 0" class="cohort-empty">
      No {{ status }} class members on this page.
    </p>
    <ul v-else class="cohort-list cohort-member-list">
      <li v-for="member in memberships" :key="member.id">
        <div>
          <strong>{{ member.username }}</strong
          ><small>{{ member.email }} · {{ status }}</small>
        </div>
        <div class="cohort-row-actions">
          <template v-if="status === 'pending'">
            <button
              class="btn btn-primary"
              type="button"
              :disabled="pendingIds[member.id] || busy"
              @click="$emit('approve', member)"
            >
              Approve
            </button>
            <button
              class="btn btn-secondary"
              type="button"
              :disabled="pendingIds[member.id] || busy"
              @click="$emit('reject', member)"
            >
              Decline
            </button>
          </template>
          <button
            v-else-if="status === 'active'"
            class="btn btn-secondary"
            type="button"
            :disabled="pendingIds[member.id] || busy"
            @click="$emit('remove', member)"
          >
            Remove
          </button>
          <button
            v-if="status === 'active' && recoveryAllowed"
            class="btn btn-secondary"
            type="button"
            :disabled="pendingIds[member.id] || busy"
            :aria-label="`Prepare password reset link for ${member.username}`"
            @click="$emit('recover', member)"
          >
            Prepare password reset link
          </button>
        </div>
      </li>
    </ul>
    <div v-if="total > 20" class="cohort-pagination">
      <button
        class="btn btn-secondary"
        type="button"
        :disabled="page <= 1 || busy"
        @click="$emit('page', page - 1)"
      >
        Previous
      </button>
      <span>Page {{ page }} of {{ Math.max(1, Math.ceil(total / 20)) }}</span>
      <button
        class="btn btn-secondary"
        type="button"
        :disabled="page * 20 >= total || busy"
        @click="$emit('page', page + 1)"
      >
        Next
      </button>
    </div>
  </section>
</template>
