<script setup lang="ts">
import { useFormField } from './useFormField'

const { id } = useFormField()
</script>

<template>
  <p :id="`${id}-description`" data-slot="form-description" class="text-xs text-muted-foreground">
    <slot />
  </p>
</template>
