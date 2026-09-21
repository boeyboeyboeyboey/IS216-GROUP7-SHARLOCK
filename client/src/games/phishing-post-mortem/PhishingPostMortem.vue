<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import CaseDebrief from './components/CaseDebrief.vue'
import EmailInspector from './components/EmailInspector.vue'
import EvidenceTimeline from './components/EvidenceTimeline.vue'
import InboxList from './components/InboxList.vue'
import SharmailShell from './components/SharmailShell.vue'
import VerdictPanel from './components/VerdictPanel.vue'
import { usePhishingCase } from './composables/usePhishingCase.js'
import './phish.css'

const {
  caseFile,
  emails,
  loading,
  submitting,
  error,
  result,
  selectedEmailId,
  selectedEmail,
  accusedEmailId,
  accusedEmail,
  selectedEvidenceIds,
  pane,
  canSubmit,
  load,
  replay,
  submit,
  selectEmail,
  accuse,
  inspectLink,
  setEvidence,
  showInbox,
} = usePhishingCase()

const readingPane = ref(null)
const unread = computed(() => emails.value.filter((email) => !email.read).length)

onMounted(() => load())

// the narrow layout swaps panes, so focus has to follow the reader in both directions
async function openMessage(id) {
  selectEmail(id)
  await nextTick()
  readingPane.value?.focus({ preventScroll: true })
}

async function backToInbox() {
  const previous = selectedEmailId.value
  showInbox()
  await nextTick()
  document
    .querySelector(`.sharmail-row[data-email-id="${previous}"]`)
    ?.focus({ preventScroll: true })
}
</script>

<template>
  <div class="phish-game">
    <div class="phish-intro">
      <RouterLink to="/" class="phish-back">Back to town</RouterLink>
      <h1 tabindex="-1">The Phishing Post-Mortem</h1>
      <p class="phish-strap">
        Several of these messages are hostile. Only one of them caused the compromise. Find it, and
        prove it with two pieces of evidence.
      </p>
    </div>

    <p v-if="loading" class="phish-state" role="status">Opening the case file...</p>

    <div v-else-if="error" class="phish-state phish-error" role="alert">
      <p>{{ error }}</p>
      <button type="button" class="sharmail-submit" @click="load()">Try again</button>
    </div>

    <SharmailShell
      v-else-if="caseFile"
      :mailbox="caseFile.organisation"
      :case-title="caseFile.title"
      :unread="unread"
    >
      <section
        class="sharmail-pane sharmail-pane-list"
        :class="{ 'is-mobile-hidden': pane === 'message' }"
        aria-label="Inbox"
      >
        <header class="sharmail-pane-head">
          <h2>Inbox</h2>
          <p>{{ emails.length }} messages &middot; {{ unread }} unread</p>
        </header>
        <InboxList
          :emails="emails"
          :selected-email-id="selectedEmailId"
          @select-email="openMessage"
        />
      </section>

      <section
        ref="readingPane"
        class="sharmail-pane sharmail-pane-reading"
        :class="{ 'is-mobile-hidden': pane === 'inbox' }"
        tabindex="-1"
        aria-label="Reading pane"
      >
        <button type="button" class="sharmail-back" @click="backToInbox">Back to inbox</button>

        <CaseDebrief v-if="result" :result="result" @replay="replay" />

        <template v-else>
          <div v-if="!selectedEmail" class="sharmail-briefing">
            <h2>{{ caseFile.title }}</h2>
            <p>{{ caseFile.briefing }}</p>
            <p class="sharmail-briefing-hint">
              Open a message to inspect its sender, reply-to address and where its links really
              point. Times are shown in {{ caseFile.timezoneLabel }}.
            </p>
          </div>

          <template v-else>
            <EmailInspector :email="selectedEmail" @inspect-link="inspectLink" />
            <div class="sharmail-accuse-row">
              <button
                type="button"
                class="sharmail-accuse"
                :class="{ 'is-accused': accusedEmailId === selectedEmail.id }"
                :aria-pressed="accusedEmailId === selectedEmail.id"
                @click="accuse(selectedEmail.id)"
              >
                {{
                  accusedEmailId === selectedEmail.id
                    ? 'Accused as Patient Zero'
                    : 'Accuse this message'
                }}
              </button>
            </div>
          </template>

          <EvidenceTimeline :events="caseFile.timeline" />

          <VerdictPanel
            :selected-email-id="accusedEmailId"
            :selected-subject="accusedEmail?.subject ?? ''"
            :evidence-options="caseFile.evidenceOptions"
            :selected-evidence-ids="selectedEvidenceIds"
            :disabled="submitting"
            @update-evidence="setEvidence"
            @submit-verdict="submit"
          />

          <p v-if="!canSubmit && accusedEmailId" class="sharmail-verdict-note">
            Choose exactly two supporting clues to submit.
          </p>
        </template>
      </section>
    </SharmailShell>
  </div>
</template>
