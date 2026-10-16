<script setup>
import { ref } from 'vue'

const props = defineProps({
  institutions: { type: Array, default: () => [] },
  cohorts: { type: Array, default: () => [] },
  institutionPage: { type: Number, default: 1 },
  institutionTotal: { type: Number, default: 0 },
  cohortPage: { type: Number, default: 1 },
  cohortTotal: { type: Number, default: 0 },
  selectedInstitutionId: { type: String, default: '' },
  loadingInstitutions: { type: Boolean, default: false },
  loadingCohorts: { type: Boolean, default: false },
  pendingInstitution: { type: Boolean, default: false },
  pendingCohort: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits([
  'create-institution',
  'create-cohort',
  'select-institution',
  'institution-page',
  'cohort-page',
])

const institutionName = ref('')
const institutionSlug = ref('')
const cohortName = ref('')
const cohortTerm = ref('')

function createInstitution() {
  emit('create-institution', {
    name: institutionName.value,
    slug: institutionSlug.value,
  })
}

function createCohort() {
  emit('create-cohort', {
    institutionId: props.selectedInstitutionId,
    name: cohortName.value,
    term: cohortTerm.value,
  })
}

function resetInstitutionForm() {
  institutionName.value = ''
  institutionSlug.value = ''
}

function resetCohortForm() {
  cohortName.value = ''
  cohortTerm.value = ''
}

defineExpose({ resetInstitutionForm, resetCohortForm })

function statusLabel(status) {
  return status === 'active' ? 'Active' : 'Inactive'
}
</script>

<template>
  <section class="admin-workspace__panel" aria-labelledby="institution-class-title">
    <div class="admin-workspace__section-heading">
      <div>
        <p class="admin-workspace__eyebrow">PLACE AND CLASS</p>
        <h2 id="institution-class-title">Institutions and classes</h2>
      </div>
    </div>

    <p v-if="error" class="admin-workspace__alert" role="alert">{{ error }}</p>

    <div class="admin-workspace__two-column">
      <form class="admin-workspace__form" @submit.prevent="createInstitution">
        <h3>Create an institution</h3>
        <label for="admin-institution-name">Institution name</label>
        <input
          id="admin-institution-name"
          v-model="institutionName"
          name="name"
          autocomplete="organization"
          maxlength="100"
          required
          :disabled="pendingInstitution"
        />
        <label for="admin-institution-slug">Institution slug</label>
        <input
          id="admin-institution-slug"
          v-model="institutionSlug"
          name="slug"
          autocapitalize="none"
          maxlength="64"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          required
          :disabled="pendingInstitution"
        />
        <small>Use lowercase letters or numbers separated by single hyphens.</small>
        <button class="admin-workspace__button" type="submit" :disabled="pendingInstitution">
          {{ pendingInstitution ? 'Creating…' : 'Create institution' }}
        </button>
      </form>

      <div class="admin-workspace__list-panel">
        <h3>Institutions</h3>
        <p v-if="loadingInstitutions" role="status">Loading institutions…</p>
        <p v-else-if="institutions.length === 0" class="admin-workspace__empty">
          No institutions are listed yet.
        </p>
        <ul v-else class="admin-workspace__list">
          <li v-for="institution in institutions" :key="institution.id">
            <div>
              <strong>{{ institution.name }}</strong>
              <span>{{ institution.slug }} · {{ statusLabel(institution.status) }}</span>
            </div>
            <button
              class="admin-workspace__text-button"
              type="button"
              :aria-pressed="selectedInstitutionId === institution.id"
              @click="emit('select-institution', institution.id)"
            >
              {{ selectedInstitutionId === institution.id ? 'Selected' : 'Use for class' }}
            </button>
          </li>
        </ul>
        <div class="admin-workspace__pagination" aria-label="Institution pages">
          <button
            class="admin-workspace__text-button"
            type="button"
            :disabled="institutionPage <= 1 || loadingInstitutions"
            @click="emit('institution-page', institutionPage - 1)"
          >
            Previous
          </button>
          <span
            >Page {{ institutionPage }} of {{ Math.max(1, Math.ceil(institutionTotal / 20)) }}</span
          >
          <button
            class="admin-workspace__text-button"
            type="button"
            :disabled="institutionPage * 20 >= institutionTotal || loadingInstitutions"
            @click="emit('institution-page', institutionPage + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <div class="admin-workspace__two-column admin-workspace__two-column--classes">
      <form class="admin-workspace__form" @submit.prevent="createCohort">
        <h3>Create a class</h3>
        <label for="admin-cohort-institution">Institution</label>
        <select
          id="admin-cohort-institution"
          :value="selectedInstitutionId"
          required
          :disabled="pendingCohort || institutions.length === 0"
          @change="emit('select-institution', $event.target.value)"
        >
          <option value="" disabled>Select an institution</option>
          <option v-for="institution in institutions" :key="institution.id" :value="institution.id">
            {{ institution.name }}
          </option>
        </select>
        <label for="admin-cohort-name">Class name</label>
        <input
          id="admin-cohort-name"
          v-model="cohortName"
          name="name"
          maxlength="100"
          required
          :disabled="pendingCohort"
        />
        <label for="admin-cohort-term">Term</label>
        <input
          id="admin-cohort-term"
          v-model="cohortTerm"
          name="term"
          maxlength="50"
          required
          :disabled="pendingCohort"
        />
        <button
          class="admin-workspace__button"
          type="submit"
          :disabled="pendingCohort || !selectedInstitutionId"
        >
          {{ pendingCohort ? 'Creating…' : 'Create class' }}
        </button>
      </form>

      <div class="admin-workspace__list-panel">
        <h3>Classes</h3>
        <p v-if="loadingCohorts" role="status">Loading classes…</p>
        <p v-else-if="cohorts.length === 0" class="admin-workspace__empty">
          No classes are listed for this institution.
        </p>
        <ul v-else class="admin-workspace__list">
          <li v-for="cohort in cohorts" :key="cohort.id">
            <div>
              <strong>{{ cohort.name }}</strong>
              <span
                >{{ cohort.institutionName }} · {{ cohort.term }} ·
                {{ statusLabel(cohort.status) }}</span
              >
            </div>
          </li>
        </ul>
        <div class="admin-workspace__pagination" aria-label="Class pages">
          <button
            class="admin-workspace__text-button"
            type="button"
            :disabled="cohortPage <= 1 || loadingCohorts"
            @click="emit('cohort-page', cohortPage - 1)"
          >
            Previous
          </button>
          <span>Page {{ cohortPage }} of {{ Math.max(1, Math.ceil(cohortTotal / 20)) }}</span>
          <button
            class="admin-workspace__text-button"
            type="button"
            :disabled="cohortPage * 20 >= cohortTotal || loadingCohorts"
            @click="emit('cohort-page', cohortPage + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
