<script setup>
import { toggleItem } from '../clearanceTower.js'

const props = defineProps({
  files: { type: Array, required: true },
  clearances: { type: Array, required: true },
  categories: { type: Array, default: () => [] },
  modelValue: { type: Object, required: true },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

function updateLabel(fileId, changes) {
  const label = { ...props.modelValue[fileId], ...changes }
  emit('update:modelValue', { ...props.modelValue, [fileId]: label })
}

function toggleCategory(fileId, categoryId) {
  updateLabel(fileId, { categories: toggleItem(props.modelValue[fileId].categories, categoryId) })
}
</script>

<template>
  <div class="clear-labels">
    <fieldset v-for="file in files" :key="file.id" class="clear-label-card">
      <legend>{{ file.name }}</legend>
      <label class="clear-field">
        <span>Level</span>
        <select
          :value="modelValue[file.id].level"
          :disabled="disabled"
          @change="updateLabel(file.id, { level: $event.target.value })"
        >
          <option v-for="clearance in clearances" :key="clearance.id" :value="clearance.id">
            {{ clearance.name }}
          </option>
        </select>
      </label>
      <div v-if="categories.length" class="clear-checks">
        <span class="clear-checks-title">Categories</span>
        <label v-for="category in categories" :key="category.id" class="clear-check">
          <input
            type="checkbox"
            :checked="modelValue[file.id].categories.includes(category.id)"
            :disabled="disabled"
            @change="toggleCategory(file.id, category.id)"
          />
          {{ category.name }}
        </label>
      </div>
    </fieldset>
  </div>
</template>
