<script setup lang="ts">
import { provide } from 'vue'
import { FORM_ITEM_INJECTION_KEY } from './injectionKeys'

const props = defineProps<{
  id?: string
  name?: string
  error?: string
}>()

provide(FORM_ITEM_INJECTION_KEY, {
  id: props.id,
  name: props.name,
  error: props.error,
})
</script>

<template>
  <div data-slot="form-item" class="space-y-2">
    <slot />
  </div>
</template>
