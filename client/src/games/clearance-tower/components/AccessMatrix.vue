<script setup>
import { computed } from 'vue'
import { hasRight, nameOf, toggleRight } from '../clearanceTower.js'

const props = defineProps({
  agents: { type: Array, required: true },
  files: { type: Array, required: true },
  modelValue: { type: Array, required: true },
  view: { type: String, default: 'matrix' },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'update:view'])

const VIEWS = [
  { id: 'matrix', label: 'Matrix' },
  { id: 'acl', label: 'Access lists' },
  { id: 'capability', label: 'Capabilities' },
]
const RIGHTS = [
  { id: 'r', word: 'read' },
  { id: 'w', word: 'write' },
]

function rightsText(grant) {
  return grant.rights.join(' ')
}

// the same grants, stored with each file (access lists) or with each agent (capabilities)
const accessLists = computed(() =>
  props.files.map((file) => ({
    id: file.id,
    name: file.name,
    entries: props.modelValue
      .filter((grant) => grant.object === file.id)
      .map((grant) => `${nameOf(props.agents, grant.subject)}: ${rightsText(grant)}`),
  })),
)

const capabilities = computed(() =>
  props.agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    entries: props.modelValue
      .filter((grant) => grant.subject === agent.id)
      .map((grant) => `${nameOf(props.files, grant.object)}: ${rightsText(grant)}`),
  })),
)

const listedRows = computed(() => (props.view === 'acl' ? accessLists.value : capabilities.value))

function toggle(agentId, fileId, right) {
  emit('update:modelValue', toggleRight(props.modelValue, agentId, fileId, right))
}
</script>

<template>
  <div class="clear-matrix">
    <div class="clear-switch" role="group" aria-label="Show the policy as">
      <button
        v-for="option in VIEWS"
        :key="option.id"
        type="button"
        class="clear-button clear-switch-button"
        :aria-pressed="view === option.id"
        @click="emit('update:view', option.id)"
      >
        {{ option.label }}
      </button>
    </div>

    <div v-if="view === 'matrix'" class="clear-table-wrap">
      <table class="clear-table">
        <caption>
          Access matrix: press r or w to grant or remove a right
        </caption>
        <thead>
          <tr>
            <th scope="col">Agent</th>
            <th v-for="file in files" :key="file.id" scope="col">{{ file.name }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="agent in agents" :key="agent.id">
            <th scope="row">{{ agent.name }}</th>
            <td v-for="file in files" :key="file.id">
              <button
                v-for="right in RIGHTS"
                :key="right.id"
                type="button"
                class="clear-right"
                :aria-pressed="hasRight(modelValue, agent.id, file.id, right.id)"
                :aria-label="`${agent.name} may ${right.word} ${file.name}`"
                :disabled="disabled"
                @click="toggle(agent.id, file.id, right.id)"
              >
                {{ right.id }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else>
      <p class="clear-hint">
        {{
          view === 'acl'
            ? 'Access lists store each column of the matrix with its file.'
            : 'Capabilities store each row of the matrix with its agent, like a keycard.'
        }}
        Switch back to Matrix to edit.
      </p>
      <dl class="clear-list-view">
        <template v-for="row in listedRows" :key="row.id">
          <dt>{{ row.name }}</dt>
          <dd>{{ row.entries.length ? row.entries.join(' · ') : 'Nothing granted' }}</dd>
        </template>
      </dl>
    </div>
  </div>
</template>
