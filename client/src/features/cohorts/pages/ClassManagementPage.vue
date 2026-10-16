<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import EnrollmentCodePanel from '../components/EnrollmentCodePanel.vue'
import EnrollmentQueue from '../components/EnrollmentQueue.vue'
import {
  getEnrollmentCode,
  issueValidatedEnrollmentCode,
  listCohortMemberships,
  listManagedCohorts,
  revokeEnrollmentCode,
  safeError,
  updateMembership,
} from '../api.js'
import '../cohorts.css'

const cohorts = ref([])
const selectedId = ref('')
const memberships = ref([])
const codeInfo = ref(null)
const invitationUrl = ref('')
const codeRevision = ref(0)
const codePanel = ref(null)
const status = ref('pending')
const cohortPage = ref(1)
const cohortTotal = ref(0)
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const savingCode = ref(false)
const error = ref('')
const notice = ref('')
const pendingIds = ref(Object.create(null))
const membershipMutationPending = ref(false)
const workspaceBusy = computed(
  () => loading.value || savingCode.value || membershipMutationPending.value,
)
const currentCohort = computed(() =>
  cohorts.value.find((cohort) => cohort.cohortId === selectedId.value),
)
const controllers = new Set()
let generation = 0
function statusLabel(value) {
  if (value === 'pending') return 'Requests'
  if (value === 'active') return 'Active'
  return 'Removed'
}
function requestController() {
  const controller = new AbortController()
  controllers.add(controller)
  return controller
}

function clearOneTimeCode() {
  codePanel.value?.clearCode()
  invitationUrl.value = ''
}

async function loadCohorts(nextPage = cohortPage.value) {
  const operation = ++generation
  const controller = requestController()
  cohortPage.value = nextPage
  codeInfo.value = null
  clearOneTimeCode()
  loading.value = true
  error.value = ''
  try {
    const result = await listManagedCohorts({
      page: nextPage,
      limit: 50,
      signal: controller.signal,
    })
    if (operation !== generation) return
    cohorts.value = result.cohorts || []
    cohortTotal.value = result.total || 0
    if (!cohorts.value.some((cohort) => cohort.cohortId === selectedId.value))
      selectedId.value = cohorts.value[0]?.cohortId || ''
    if (selectedId.value) await loadSelected()
  } catch (cause) {
    if (!controller.signal.aborted && operation === generation)
      error.value = safeError(cause).message
  } finally {
    controllers.delete(controller)
    if (operation === generation) loading.value = false
  }
}

async function loadSelected(nextPage = 1) {
  if (!selectedId.value) return
  const operation = ++generation
  const cohortId = selectedId.value
  const controller = requestController()
  clearOneTimeCode()
  page.value = nextPage
  loading.value = true
  error.value = ''
  try {
    const [result, code] = await Promise.all([
      listCohortMemberships(cohortId, {
        status: status.value,
        page: nextPage,
        limit: 20,
        signal: controller.signal,
      }),
      getEnrollmentCode(cohortId, controller.signal),
    ])
    if (operation !== generation) return
    memberships.value = result.memberships || []
    total.value = result.total || 0
    codeInfo.value = code.code
    codeRevision.value = code.revision || 0
  } catch (cause) {
    if (!controller.signal.aborted && operation === generation)
      error.value = safeError(cause).message
  } finally {
    controllers.delete(controller)
    if (operation === generation) loading.value = false
  }
}

function selectCohort(id) {
  selectedId.value = id
  status.value = 'pending'
  notice.value = ''
  codeInfo.value = null
  clearOneTimeCode()
  void loadSelected(1)
}
function selectStatus(nextStatus) {
  status.value = nextStatus
  void loadSelected(1)
}

async function changeMembership(member, nextStatus) {
  if (pendingIds.value[member.id] || workspaceBusy.value) return
  const cohortId = selectedId.value
  const operation = generation
  const controller = requestController()
  membershipMutationPending.value = true
  pendingIds.value = { ...pendingIds.value, [member.id]: true }
  error.value = ''
  notice.value = ''
  try {
    await updateMembership(cohortId, member.id, nextStatus, member.revision, controller.signal)
    if (generation !== operation || selectedId.value !== cohortId) return
    if (nextStatus === 'active') notice.value = 'Class access approved.'
    else if (status.value === 'active') notice.value = 'Class access removed.'
    else notice.value = 'Join request declined.'
    await loadSelected(page.value)
  } catch (cause) {
    if (!controller.signal.aborted) error.value = safeError(cause).message
  } finally {
    controllers.delete(controller)
    const next = { ...pendingIds.value }
    delete next[member.id]
    pendingIds.value = next
    membershipMutationPending.value = false
  }
}

async function generateCode(expectedRevision) {
  if (savingCode.value) return
  const cohortId = selectedId.value
  const operation = generation
  codeInfo.value = null
  clearOneTimeCode()
  const controller = requestController()
  savingCode.value = true
  error.value = ''
  try {
    const result = await issueValidatedEnrollmentCode(cohortId, expectedRevision, controller.signal)
    if (generation !== operation || selectedId.value !== cohortId) return
    codeInfo.value = result.code || { id: result.id, expiresAt: result.expiresAt, revokedAt: null }
    codeRevision.value = result.revision || 0
    invitationUrl.value = result.invitationUrl
    await nextTick()
    codePanel.value?.receiveCode(result.rawCode)
    notice.value = 'A new seven-day code is ready to share. The previous code has been revoked.'
  } catch (cause) {
    if (!controller.signal.aborted) error.value = safeError(cause).message
  } finally {
    controllers.delete(controller)
    savingCode.value = false
  }
}

async function revokeCode({ id, revision }) {
  if (savingCode.value) return
  const cohortId = selectedId.value
  const operation = generation
  clearOneTimeCode()
  const controller = requestController()
  savingCode.value = true
  error.value = ''
  try {
    const result = await revokeEnrollmentCode(cohortId, id, revision, controller.signal)
    if (generation !== operation || selectedId.value !== cohortId) return
    codeInfo.value = result.code || result
    codeRevision.value = result.revision || 0
    notice.value = 'The invitation code was revoked.'
  } catch (cause) {
    if (!controller.signal.aborted) error.value = safeError(cause).message
  } finally {
    controllers.delete(controller)
    savingCode.value = false
  }
}

onMounted(() => loadCohorts(1))
onBeforeUnmount(() => {
  generation += 1
  controllers.forEach((controller) => controller.abort())
  clearOneTimeCode()
})
</script>

<template>
  <section class="cohort-page" aria-labelledby="class-management-title">
    <p class="cohort-eyebrow">INSTRUCTOR DESK</p>
    <h1 id="class-management-title" tabindex="-1">Manage your classes</h1>
    <p class="cohort-intro">
      Review join requests, manage class access and share an invitation code with learners.
    </p>
    <p v-if="error" class="cohort-alert" role="alert">{{ error }}</p>
    <p v-if="notice" class="cohort-notice" role="status">{{ notice }}</p>
    <p v-if="loading && cohorts.length === 0" role="status">Loading your classes…</p>
    <p v-else-if="cohorts.length === 0" class="cohort-empty">
      No active classes are assigned to your account.
    </p>
    <template v-else>
      <label class="cohort-label" for="managed-class">Class</label>
      <select
        id="managed-class"
        v-model="selectedId"
        :disabled="workspaceBusy"
        @change="selectCohort(selectedId)"
      >
        <option v-for="cohort in cohorts" :key="cohort.cohortId" :value="cohort.cohortId">
          {{ cohort.cohortName }} · {{ cohort.institutionName }}
        </option>
      </select>
      <div v-if="cohortTotal > 50" class="cohort-pagination" aria-label="Assigned class pages">
        <button
          class="btn btn-secondary"
          type="button"
          :disabled="workspaceBusy || cohortPage <= 1"
          @click="loadCohorts(cohortPage - 1)"
        >
          Previous classes
        </button>
        <span>Page {{ cohortPage }} of {{ Math.max(1, Math.ceil(cohortTotal / 50)) }}</span>
        <button
          class="btn btn-secondary"
          type="button"
          :disabled="workspaceBusy || cohortPage * 50 >= cohortTotal"
          @click="loadCohorts(cohortPage + 1)"
        >
          Next classes
        </button>
      </div>
      <EnrollmentCodePanel
        ref="codePanel"
        :code="codeInfo"
        :invitation-url="invitationUrl"
        :expires-at="codeInfo?.expiresAt"
        :revision="codeRevision"
        :pending="savingCode"
        @generate="generateCode"
        @revoke="revokeCode"
        @clear="invitationUrl = ''"
      />
      <section class="cohort-panel" aria-labelledby="member-queue-title">
        <h2 id="member-queue-title">Class access</h2>
        <div class="cohort-tabs" role="group" aria-label="Membership status">
          <button
            v-for="option in ['pending', 'active', 'removed']"
            :key="option"
            class="btn"
            :class="status === option ? 'btn-primary' : 'btn-secondary'"
            type="button"
            :disabled="workspaceBusy"
            :aria-pressed="status === option"
            @click="selectStatus(option)"
          >
            {{ statusLabel(option) }}
          </button>
        </div>
        <p v-if="loading" role="status">Loading class members…</p>
        <EnrollmentQueue
          v-else
          :memberships="memberships"
          :pending-ids="pendingIds"
          :status="status"
          :page="page"
          :total="total"
          :busy="workspaceBusy"
          @approve="changeMembership($event, 'active')"
          @reject="changeMembership($event, 'removed')"
          @remove="changeMembership($event, 'removed')"
          @page="loadSelected"
        />
      </section>
      <p v-if="currentCohort" class="cohort-muted">
        {{ currentCohort.cohortName }} · {{ currentCohort.institutionName }}
      </p>
    </template>
  </section>
</template>
