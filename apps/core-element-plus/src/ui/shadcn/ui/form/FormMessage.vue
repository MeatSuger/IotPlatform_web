<script setup lang="ts">
import { useFormField } from './useFormField'

const { id, error } = useFormField()
</script>

<template>
  <p :id="`${id}-message`" data-slot="form-message" class="text-xs text-destructive" role="alert">
    {{ error }}
  </p>
</template>
