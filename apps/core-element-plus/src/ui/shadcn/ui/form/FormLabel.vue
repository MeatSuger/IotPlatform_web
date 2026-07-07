<script setup lang="ts">
import { useFormField } from './useFormField'

const { id } = useFormField()
</script>

<template>
  <label data-slot="form-label" :for="id" class="text-sm leading-none font-medium peer-disabled:opacity-70 peer-disabled:cursor-not-allowed">
    <slot />
  </label>
</template>
