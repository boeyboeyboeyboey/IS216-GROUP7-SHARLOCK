<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  instructor: { type: Object, required: true },
  cohorts: { type: Array, default: () => [] },
  cohortPage: { type: Number, default: 1 },
  cohortTotal: { type: Number, default: 0 },
  pending: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['save', 'reload', 'cohort-page'])
const draftIds = ref([])
const displayedCohorts = computed(() => props.cohorts.filter(cohortIsEligible))
const retainedAssignments = computed(() => {
  const assigned = Array.isArray(props.instructor.assignedCohorts)
    ? props.instructor.assignedCohorts
    : props.cohorts.filter((cohort) => props.instructor.cohortIds?.includes(cohort.id))
  return assigned.filter((cohort) => !cohortIsEligible(cohort))
})

function cohortIsEligible(cohort) {
  return cohort.status === 'active' && cohort.institutionStatus === 'active'
}

function resetDraft() {
  draftIds.value = Array.isArray(props.instructor.cohortIds) ? [...props.instructor.cohortIds] : []
}

watch(
  () => [
    props.instructor.id,
    props.instructor.assignmentRevision,
    Array.isArray(props.instructor.cohortIds) ? props.instructor.cohortIds.join(',') : '',
  ],
  resetDraft,
  { immediate: true },
)

function setSelected(cohortId, selected) {
  const selectedIds = new Set(draftIds.value)
  if (selected) selectedIds.add(cohortId)
  else selectedIds.delete(cohortId)
  draftIds.value = [...selectedIds]
}

function save() {
  emit('save', {
    instructorId: props.instructor.id,
    input: {
      cohortIds: [...draftIds.value],
      expectedRevision: props.instructor.assignmentRevision,
    },
  })
}

function statusLabel(status) {
  return status === 'active'
    ? 'Active'
    : status === 'disabled'
      ? 'Awaiting activation'
      : 'Unavailable'
}
</script>

<template>
  <article class="admin-workspace__instructor" :aria-labelledby="`instructor-${instructor.id}`">
    <div class="admin-workspace__instructor-heading">
      <div>
        <h3 :id="`instructor-${instructor.id}`">{{ instructor.username }}</h3>
        <p>{{ instructor.email }}</p>
      </div>
      <span class="admin-workspace__status">{{ statusLabel(instructor.accountStatus) }}</span>
    </div>

    <p v-if="error" class="admin-workspace__alert" role="alert">{{ error }}</p>
    <p v-if="instructor.accountStatus !== 'active'" class="admin-workspace__empty">
      The instructor must activate their account before class access can be assigned.
    </p>
    <fieldset
      class="admin-workspace__assignment-list"
      :disabled="pending || instructor.accountStatus !== 'active'"
    >
      <legend>Available and retained classes</legend>
      <p v-if="displayedCohorts.length === 0" class="admin-workspace__empty">
        No active classes or retained assignments are available on this page.
      </p>
      <label
        v-for="cohort in displayedCohorts"
        :key="cohort.id"
        class="admin-workspace__assignment"
      >
        <input
          type="checkbox"
          :checked="draftIds.includes(cohort.id)"
          :disabled="!cohortIsEligible(cohort)"
          :aria-label="`${cohort.name}, ${cohort.institutionName}, ${cohort.term}`"
          @change="setSelected(cohort.id, $event.target.checked)"
        />
        <span>
          <strong>{{ cohort.name }}</strong>
          <small>{{ cohort.institutionName }} · {{ cohort.term }}</small>
        </span>
      </label>
    </fieldset>

    <ul v-if="retainedAssignments.length" class="admin-workspace__retained-assignments">
      <li v-for="cohort in retainedAssignments" :key="cohort.id">
        <strong>{{ cohort.name }}</strong>
        <span>{{ cohort.institutionName }} · {{ cohort.term }}</span>
        <small>Inactive; retained assignment</small>
      </li>
    </ul>

    <div class="admin-workspace__pagination" aria-label="Assignment class pages">
      <button
        class="admin-workspace__text-button"
        type="button"
        :disabled="cohortPage <= 1 || pending"
        @click="emit('cohort-page', cohortPage - 1)"
      >
        Previous classes
      </button>
      <span>Page {{ cohortPage }} of {{ Math.max(1, Math.ceil(cohortTotal / 50)) }}</span>
      <button
        class="admin-workspace__text-button"
        type="button"
        :disabled="cohortPage * 50 >= cohortTotal || pending"
        @click="emit('cohort-page', cohortPage + 1)"
      >
        Next classes
      </button>
    </div>

    <div class="admin-workspace__actions">
      <button
        class="admin-workspace__button"
        type="button"
        :disabled="pending || instructor.accountStatus !== 'active'"
        @click="save"
      >
        {{ pending ? 'Saving assignments…' : 'Save assignments' }}
      </button>
      <button
        v-if="error"
        class="admin-workspace__text-button"
        type="button"
        :disabled="pending"
        @click="emit('reload', instructor.id)"
      >
        Reload assignments
      </button>
    </div>
    <p class="admin-workspace__assignment-count">{{ draftIds.length }} assigned classes selected</p>
  </article>
</template>
