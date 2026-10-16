<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { avatarFor } from '../../auth/avatars.js'
import ActivationLinkDialog from '../components/ActivationLinkDialog.vue'
import AssignmentEditor from '../components/AssignmentEditor.vue'
import InstitutionCohortForm from '../components/InstitutionCohortForm.vue'
import InstructorProvisionForm from '../components/InstructorProvisionForm.vue'
import {
  AdminApiError,
  createCohort,
  createInstitution,
  createInstructor,
  listCohorts,
  listInstitutions,
  listInstructors,
  reissueInstructorActivation,
  updateInstructorAssignments,
} from '../api.js'
import '../admin.css'
import '../../auth/auth.css'

const PAGE_SIZE = 20
const ASSIGNMENT_PAGE_SIZE = 50
const institutions = ref([])
const cohorts = ref([])
const assignmentCohorts = ref([])
const instructors = ref([])
const institutionPage = ref(1)
const cohortPage = ref(1)
const assignmentCohortPage = ref(1)
const instructorPage = ref(1)
const institutionTotal = ref(0)
const cohortTotal = ref(0)
const assignmentCohortTotal = ref(0)
const instructorTotal = ref(0)
const selectedInstitutionId = ref('')
const loadingInstitutions = ref(false)
const loadingCohorts = ref(false)
const loadingAssignmentCohorts = ref(false)
const loadingInstructors = ref(false)
const pendingInstitution = ref(false)
const pendingCohort = ref(false)
const pendingInstructor = ref(false)
const pendingAssignments = ref(Object.create(null))
const reissuing = ref(Object.create(null))
const institutionError = ref('')
const instructorError = ref('')
const assignmentErrors = ref(Object.create(null))
const notice = ref('')
const activationLink = ref(null)
const institutionForm = ref(null)
const instructorForm = ref(null)
const controllers = new Map()
let disposed = false

const statusLabel = (status) => (status === 'active' ? 'Active' : 'Inactive')

function startRequest(key) {
  controllers.get(key)?.abort()
  const controller = new AbortController()
  controllers.set(key, controller)
  return controller
}

function isCurrentRequest(key, controller) {
  return !disposed && controllers.get(key) === controller && !controller.signal.aborted
}

function safeMessage(error, fallback) {
  return error instanceof AdminApiError ? error.message : fallback
}

function rowsFor(response, key) {
  return Array.isArray(response?.[key]) ? response[key] : []
}

function totalFor(response) {
  return Number.isSafeInteger(response?.total) && response.total >= 0 ? response.total : 0
}

async function loadInstitutions(page = institutionPage.value) {
  const controller = startRequest('institutions')
  institutionPage.value = page
  loadingInstitutions.value = true
  try {
    const response = await listInstitutions({ page, limit: PAGE_SIZE, signal: controller.signal })
    if (!isCurrentRequest('institutions', controller)) return
    institutions.value = rowsFor(response, 'institutions')
    institutionTotal.value = totalFor(response)
    notice.value = ''
    if (!selectedInstitutionId.value) selectedInstitutionId.value = institutions.value[0]?.id || ''
  } catch (error) {
    if (!isCurrentRequest('institutions', controller)) return
    notice.value = safeMessage(error, 'Institutions could not be loaded. Refresh and try again.')
  } finally {
    if (controllers.get('institutions') === controller) loadingInstitutions.value = false
  }
}

async function loadCohorts(page = cohortPage.value, institutionId = selectedInstitutionId.value) {
  const controller = startRequest('cohorts')
  cohortPage.value = page
  loadingCohorts.value = true
  try {
    const response = await listCohorts({
      page,
      limit: PAGE_SIZE,
      ...(institutionId ? { institutionId } : {}),
      signal: controller.signal,
    })
    if (!isCurrentRequest('cohorts', controller)) return
    cohorts.value = rowsFor(response, 'cohorts')
    cohortTotal.value = totalFor(response)
    notice.value = ''
  } catch (error) {
    if (!isCurrentRequest('cohorts', controller)) return
    notice.value = safeMessage(error, 'Classes could not be loaded. Refresh and try again.')
  } finally {
    if (controllers.get('cohorts') === controller) loadingCohorts.value = false
  }
}

async function loadAssignmentCohorts(page = assignmentCohortPage.value) {
  const controller = startRequest('assignment-cohorts')
  assignmentCohortPage.value = page
  loadingAssignmentCohorts.value = true
  try {
    const response = await listCohorts({
      page,
      limit: ASSIGNMENT_PAGE_SIZE,
      signal: controller.signal,
    })
    if (!isCurrentRequest('assignment-cohorts', controller)) return
    assignmentCohorts.value = rowsFor(response, 'cohorts').filter(
      (cohort) => cohort.status === 'active',
    )
    assignmentCohortTotal.value = totalFor(response)
  } catch (error) {
    if (!isCurrentRequest('assignment-cohorts', controller)) return
    notice.value = safeMessage(
      error,
      'Available classes could not be loaded. Refresh and try again.',
    )
  } finally {
    if (controllers.get('assignment-cohorts') === controller) {
      loadingAssignmentCohorts.value = false
    }
  }
}

async function loadInstructors(page = instructorPage.value) {
  const controller = startRequest('instructors')
  instructorPage.value = page
  loadingInstructors.value = true
  try {
    const response = await listInstructors({ page, limit: PAGE_SIZE, signal: controller.signal })
    if (!isCurrentRequest('instructors', controller)) return
    instructors.value = rowsFor(response, 'instructors')
    instructorTotal.value = totalFor(response)
    notice.value = ''
    assignmentErrors.value = Object.create(null)
  } catch (error) {
    if (!isCurrentRequest('instructors', controller)) return
    notice.value = safeMessage(error, 'Instructors could not be loaded. Refresh and try again.')
  } finally {
    if (controllers.get('instructors') === controller) loadingInstructors.value = false
  }
}

async function createInstitutionEntry(input) {
  if (pendingInstitution.value) return
  institutionError.value = ''
  pendingInstitution.value = true
  const controller = startRequest('create-institution')
  try {
    const created = await createInstitution(input, controller.signal)
    if (disposed) return
    institutionForm.value?.resetInstitutionForm()
    selectedInstitutionId.value = ''
    const lastPage = Math.floor(institutionTotal.value / PAGE_SIZE) + 1
    await loadInstitutions(created?.id ? lastPage : 1)
    if (created?.id && institutions.value.some(({ id }) => id === created.id)) {
      selectedInstitutionId.value = created.id
    }
  } catch (error) {
    if (!disposed && !controller.signal.aborted) {
      institutionError.value = safeMessage(
        error,
        'The institution could not be created. Review and try again.',
      )
    }
  } finally {
    if (controllers.get('create-institution') === controller) pendingInstitution.value = false
  }
}

async function createCohortEntry(input) {
  if (pendingCohort.value || !selectedInstitutionId.value) return
  institutionError.value = ''
  pendingCohort.value = true
  const controller = startRequest('create-cohort')
  try {
    await createCohort(input, controller.signal)
    if (disposed) return
    institutionForm.value?.resetCohortForm()
    await Promise.all([loadCohorts(1), loadAssignmentCohorts(1)])
  } catch (error) {
    if (!disposed && !controller.signal.aborted) {
      institutionError.value = safeMessage(
        error,
        'The class could not be created. Review and try again.',
      )
    }
  } finally {
    if (controllers.get('create-cohort') === controller) pendingCohort.value = false
  }
}

async function provisionInstructor(input) {
  if (pendingInstructor.value) return
  instructorError.value = ''
  pendingInstructor.value = true
  const controller = startRequest('create-instructor')
  try {
    const result = await createInstructor(input, controller.signal)
    if (disposed) return
    activationLink.value = {
      activationUrl: result.activationUrl,
      expiresAt: result.expiresAt,
    }
    instructorForm.value?.resetForm()
    await loadInstructors(1)
  } catch (error) {
    if (!disposed && !controller.signal.aborted) {
      instructorError.value = safeMessage(
        error,
        'The instructor could not be created. Review and try again.',
      )
    }
  } finally {
    if (controllers.get('create-instructor') === controller) pendingInstructor.value = false
  }
}

async function reissueActivation(instructorId) {
  if (reissuing.value[instructorId]) return
  instructorError.value = ''
  reissuing.value = { ...reissuing.value, [instructorId]: true }
  const controller = startRequest(`reissue-${instructorId}`)
  try {
    const result = await reissueInstructorActivation(instructorId, controller.signal)
    if (disposed) return
    activationLink.value = result
    await loadInstructors(instructorPage.value)
  } catch (error) {
    if (!disposed && !controller.signal.aborted) {
      instructorError.value = safeMessage(
        error,
        'A new activation link could not be prepared. Try again later.',
      )
    }
  } finally {
    if (controllers.get(`reissue-${instructorId}`) === controller) {
      reissuing.value = { ...reissuing.value, [instructorId]: false }
    }
  }
}

async function saveAssignments({ instructorId, input }) {
  if (pendingAssignments.value[instructorId]) return
  assignmentErrors.value = { ...assignmentErrors.value, [instructorId]: '' }
  pendingAssignments.value = { ...pendingAssignments.value, [instructorId]: true }
  const controller = startRequest(`assignments-${instructorId}`)
  try {
    await updateInstructorAssignments(instructorId, input, controller.signal)
    if (disposed) return
    await loadInstructors(instructorPage.value)
  } catch (error) {
    if (disposed || controller.signal.aborted) return
    const message =
      error instanceof AdminApiError && error.code === 'ADMIN_STALE_ASSIGNMENTS'
        ? 'Assignments changed elsewhere. Your draft is preserved. Reload before trying again.'
        : safeMessage(error, 'Assignments could not be saved. Review and try again.')
    assignmentErrors.value = { ...assignmentErrors.value, [instructorId]: message }
  } finally {
    if (controllers.get(`assignments-${instructorId}`) === controller) {
      pendingAssignments.value = { ...pendingAssignments.value, [instructorId]: false }
    }
  }
}

async function reloadAssignments() {
  await loadInstructors(instructorPage.value)
}

watch(selectedInstitutionId, (institutionId) => {
  cohortPage.value = 1
  assignmentCohortPage.value = 1
  loadCohorts(1, institutionId)
  loadAssignmentCohorts(1)
})

onMounted(() => {
  loadInstitutions(1)
  loadInstructors(1)
})

onBeforeUnmount(() => {
  disposed = true
  for (const controller of controllers.values()) controller.abort()
  controllers.clear()
  activationLink.value = null
})
</script>

<template>
  <div class="admin-workspace">
    <header class="admin-workspace__hero">
      <div class="admin-workspace__hero-icon" aria-hidden="true"><span>HQ</span></div>
      <div>
        <p class="admin-workspace__eyebrow">ADMINISTRATOR DESK</p>
        <h1>Admin workspace</h1>
        <p>Set up learning spaces, invite instructors, and manage their class access.</p>
      </div>
    </header>

    <p v-if="notice" class="admin-workspace__alert" role="alert">{{ notice }}</p>

    <InstitutionCohortForm
      ref="institutionForm"
      :institutions="institutions"
      :cohorts="cohorts"
      :institution-page="institutionPage"
      :institution-total="institutionTotal"
      :cohort-page="cohortPage"
      :cohort-total="cohortTotal"
      :selected-institution-id="selectedInstitutionId"
      :loading-institutions="loadingInstitutions"
      :loading-cohorts="loadingCohorts"
      :pending-institution="pendingInstitution"
      :pending-cohort="pendingCohort"
      :error="institutionError"
      @create-institution="createInstitutionEntry"
      @create-cohort="createCohortEntry"
      @select-institution="selectedInstitutionId = $event"
      @institution-page="loadInstitutions"
      @cohort-page="loadCohorts"
    />

    <InstructorProvisionForm
      ref="instructorForm"
      :pending="pendingInstructor"
      :error="instructorError"
      @provision="provisionInstructor"
    />

    <section class="admin-workspace__panel" aria-labelledby="instructors-title">
      <div class="admin-workspace__section-heading">
        <div>
          <p class="admin-workspace__eyebrow">ACCESS AND ASSIGNMENTS</p>
          <h2 id="instructors-title">Instructors</h2>
        </div>
        <button
          class="admin-workspace__text-button"
          type="button"
          :disabled="loadingInstructors"
          @click="loadInstructors(instructorPage)"
        >
          {{ loadingInstructors ? 'Refreshing…' : 'Refresh instructors' }}
        </button>
      </div>
      <p v-if="loadingInstructors && instructors.length === 0" role="status">
        Loading instructors…
      </p>
      <p v-else-if="instructors.length === 0" class="admin-workspace__empty">
        No instructors are listed yet.
      </p>
      <div v-else class="admin-workspace__instructor-list">
        <div
          v-for="instructor in instructors"
          :key="instructor.id"
          class="admin-workspace__instructor-row"
        >
          <div class="admin-workspace__instructor-identity">
            <img
              :src="avatarFor(instructor.avatarId).path"
              width="48"
              height="48"
              :alt="`${avatarFor(instructor.avatarId).label} capybara avatar`"
            />
            <div>
              <strong>{{ instructor.username }}</strong>
              <span>{{ instructor.email }}</span>
              <span class="admin-workspace__status">
                {{ statusLabel(instructor.accountStatus) }}
              </span>
            </div>
          </div>
          <button
            v-if="instructor.accountStatus === 'disabled'"
            class="admin-workspace__text-button"
            type="button"
            :disabled="reissuing[instructor.id]"
            @click="reissueActivation(instructor.id)"
          >
            {{ reissuing[instructor.id] ? 'Preparing link…' : 'Reissue activation link' }}
          </button>
          <AssignmentEditor
            :instructor="instructor"
            :cohorts="assignmentCohorts"
            :cohort-page="assignmentCohortPage"
            :cohort-total="assignmentCohortTotal"
            :pending="Boolean(pendingAssignments[instructor.id]) || loadingAssignmentCohorts"
            :error="assignmentErrors[instructor.id] || ''"
            @save="saveAssignments"
            @reload="reloadAssignments"
            @cohort-page="loadAssignmentCohorts"
          />
        </div>
      </div>
      <div class="admin-workspace__pagination" aria-label="Instructor pages">
        <button
          class="admin-workspace__text-button"
          type="button"
          :disabled="instructorPage <= 1 || loadingInstructors"
          @click="loadInstructors(instructorPage - 1)"
        >
          Previous instructors
        </button>
        <span
          >Page {{ instructorPage }} of
          {{ Math.max(1, Math.ceil(instructorTotal / PAGE_SIZE)) }}</span
        >
        <button
          class="admin-workspace__text-button"
          type="button"
          :disabled="instructorPage * PAGE_SIZE >= instructorTotal || loadingInstructors"
          @click="loadInstructors(instructorPage + 1)"
        >
          Next instructors
        </button>
      </div>
    </section>

    <ActivationLinkDialog
      v-if="activationLink"
      :link="activationLink"
      @close="activationLink = null"
    />
  </div>
</template>
