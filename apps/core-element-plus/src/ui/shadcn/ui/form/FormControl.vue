<script setup lang="ts">
import { useFormField } from './useFormField'

const { error, id, name } = useFormField()
</script>

<template>
  <div data-slot="form-control" :aria-invalid="!!error" :aria-describedby="`${id}-message`">
    <slot :id :name :error />
  </div>
</template>
