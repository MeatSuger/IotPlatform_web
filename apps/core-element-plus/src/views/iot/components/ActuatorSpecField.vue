<script setup lang="ts">
import type { TransportConfigField } from '@/api/modules/iot/actuator'

// 单个 specs 字段渲染（执行器编辑弹窗基础区 / 高级选项共用）
defineOptions({ name: 'ActuatorSpecField' })

const props = defineProps<{
  field: TransportConfigField
  modelValue?: any
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

const value = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v),
})
</script>

<template>
  <div v-if="field.type === 'bool'" class="flex gap-3 items-center sm:col-span-2">
    <FaSwitch v-model="value" />
    <span class="text-sm text-gray-400">
      {{ field.label }}<span v-if="field.hint">（{{ field.hint }}）</span>
    </span>
  </div>
  <div v-else-if="field.type === 'select'" class="flex flex-col gap-1">
    <label class="text-sm text-gray-400">{{ field.label }}<span v-if="field.required"> *</span></label>
    <FaSelect v-model="value" :options="field.options ?? []" class="w-full" />
  </div>
  <div v-else-if="field.type === 'text'" class="flex flex-col gap-1">
    <label class="text-sm text-gray-400">{{ field.label }}<span v-if="field.required"> *</span></label>
    <FaInput v-model="value" type="text" :placeholder="field.hint ?? '请输入'" class="w-full" />
  </div>
  <div v-else class="flex flex-col gap-1">
    <label class="text-sm text-gray-400">{{ field.label }}<span v-if="field.required"> *</span></label>
    <FaInput v-model="value" type="number" :placeholder="field.hint ?? '默认值'">
      <template v-if="field.unit" #end>
        <span class="text-xs text-gray-400">{{ field.unit }}</span>
      </template>
    </FaInput>
  </div>
</template>
