<script setup>
import { computed, onMounted } from 'vue'
import ChatThread from './components/ChatThread.vue'
import DecisionBar from './components/DecisionBar.vue'
import DebriefPanel from './components/DebriefPanel.vue'
import MessageComposer from './components/MessageComposer.vue'
import ScenarioBrief from './components/ScenarioBrief.vue'
import { useSocialEngineeringSession } from './composables/useSocialEngineeringSession.js'
import { MAX_MESSAGE_LENGTH } from './simulator.js'
import './sim.css'

const {
  status,
  pending,
  persona,
  brief,
  messages,
  turnsUsed,
  turnBudget,
  leaked,
  closed,
  result,
  error,
  resetCode,
  canSend,
  start,
  begin,
  send,
  complete,
  reset,
} = useSocialEngineeringSession()

const personaName = computed(() => persona.value?.displayName ?? 'Colleague')
const inConversation = computed(() => ['chatting', 'awaiting', 'ended'].includes(status.value))

onMounted(start)
</script>

<template>
  <div class="soc-game">
    <div class="soc-intro">
      <RouterLink to="/" class="soc-back">Back to town</RouterLink>
      <h1 tabindex="-1">LLM Social Engineering Simulator</h1>
      <p class="soc-strap">
        A fictional colleague will pressure you to hand over a synthetic reset code. Hold the line
        and verify the request. Everything here is simulated.
      </p>
    </div>

    <p v-if="status === 'idle' && pending" class="soc-state" role="status">
      Setting up the simulation&hellip;
    </p>

    <div v-else-if="status === 'error'" class="soc-state soc-error" role="alert">
      <p>{{ error }}</p>
      <button type="button" class="soc-button soc-button-primary" @click="start">Try again</button>
    </div>

    <ScenarioBrief
      v-else-if="status === 'briefing' && brief && persona"
      :brief="brief"
      :persona="persona"
      :reset-code="resetCode"
      @start="begin"
    />

    <div v-else-if="inConversation" class="soc-conversation">
      <DebriefPanel v-if="result" :result="result" @restart="reset" />

      <template v-else>
        <header class="soc-convo-head">
          <p class="soc-convo-persona">{{ personaName }}</p>
          <p v-if="resetCode" class="soc-convo-code">
            Your reset code:
            <code class="soc-code" data-testid="soc-reset-code-chat">{{ resetCode }}</code>
          </p>
          <p class="soc-convo-turns" aria-live="polite">Turn {{ turnsUsed }} of {{ turnBudget }}</p>
        </header>

        <ChatThread :messages="messages" :pending="pending" :persona-name="personaName" />

        <p v-if="leaked" class="soc-alert soc-alert-bad" role="alert">
          You revealed the reset code. In a real incident this would compromise the account. Choose
          how to end below.
        </p>
        <p v-else-if="closed" class="soc-alert" role="status">
          The conversation has reached its limit. Make your final decision below.
        </p>

        <MessageComposer
          v-if="!closed"
          :disabled="!canSend"
          :max-length="MAX_MESSAGE_LENGTH"
          @send="send"
        />

        <p v-if="error" class="soc-alert soc-alert-bad" role="alert">{{ error }}</p>

        <DecisionBar :disabled="pending || Boolean(result)" @decide="complete" />
      </template>
    </div>
  </div>
</template>
