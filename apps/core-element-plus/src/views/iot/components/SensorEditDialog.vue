<script setup lang="ts">
import type { FormExpose } from '@fantastic-admin/components'
import type { Sensor, SensorCreatePayload, SensorSpecs, SensorThresholds, SensorUpdatePayload } from '@/api/modules/iot/sensor'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { sensorApi } from '@/api/modules/iot/sensor'

defineOptions({
  name: 'SensorEditDialog',
})

const props = withDefaults(defineProps<{
  modelValue: boolean
  deviceId: string
  mode: 'add' | 'edit'
  sensor?: Sensor | null
}>(), {
  sensor: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

const show = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const formRef = useTemplateRef<FormExpose>('formRef')
const saving = ref(false)

// ==================== 表单字段 ====================
// 关键：只把「走 FaForm/FaFormItem 自动绑定」的字段放进 :model（id/name/type/dataType/unit）。
// 其余字段（上报周期/启用/量程/阈值/扩展属性）用独立 v-model 管理（extra），
// 避免 FaForm 双向同步时把未注册字段从 model 中删掉，导致模板访问 undefined.length 崩溃、表单消失。
const form = reactive({
  id: '',
  name: '',
  type: 'temperature',
  dataType: 'float',
  unit: '',
})

const extra = reactive({
  reportInterval: '60',
  enabled: true,
  specs: { min: '', max: '', step: '' },
  thresholds: { min: '', max: '', alarm: false },
  attrsRows: [] as { key: string, value: string }[],
})

const typeOptions = [
  { label: '温度 (temperature)', value: 'temperature' },
  { label: '湿度 (humidity)', value: 'humidity' },
  { label: '光照 (light)', value: 'light' },
  { label: '开关 (switch)', value: 'switch' },
  { label: '自定义 (custom)', value: 'custom' },
]

const dataTypeOptions = [
  { label: '浮点 (float)', value: 'float' },
  { label: '整数 (int)', value: 'int' },
  { label: '布尔 (bool)', value: 'bool' },
  { label: '文本 (text)', value: 'text' },
  { label: '枚举 (enum)', value: 'enum' },
]

const validationSchema = toTypedSchema(z.object({
  id: z.string().regex(/^[a-z]\w{0,49}$/i, '字母开头，仅含字母/数字/下划线，≤50'),
  name: z.string().min(1, '请输入名称').max(100, '名称最多 100 字符'),
  type: z.string().min(1, '请选择类别'),
  dataType: z.string().min(1, '请选择数据类型'),
  unit: z.string().max(32, '单位最多 32 字符'),
}))

function toNumber(value: string): number | undefined {
  const trimmed = String(value ?? '').trim()
  if (trimmed === '') {
    return undefined
  }
  const num = Number(trimmed)
  return Number.isNaN(num) ? undefined : num
}

function resetForm() {
  form.id = ''
  form.name = ''
  form.type = 'temperature'
  form.dataType = 'float'
  form.unit = ''
  extra.reportInterval = '60'
  extra.enabled = true
  extra.specs.min = ''
  extra.specs.max = ''
  extra.specs.step = ''
  extra.thresholds.min = ''
  extra.thresholds.max = ''
  extra.thresholds.alarm = false
  extra.attrsRows = []
}

function prefill() {
  if (props.mode === 'edit' && props.sensor) {
    const s = props.sensor
    const specs = s.specs ?? {}
    const thresholds = s.thresholds ?? {}
    const attrs = s.attrs ?? {}
    form.id = s.id
    form.name = s.name
    form.type = s.type || 'temperature'
    form.dataType = s.dataType ?? 'float'
    form.unit = s.unit ?? ''
    extra.reportInterval = s.reportInterval != null ? String(s.reportInterval) : '60'
    extra.enabled = s.enabled ?? true
    extra.specs.min = specs.min != null ? String(specs.min) : ''
    extra.specs.max = specs.max != null ? String(specs.max) : ''
    extra.specs.step = specs.step != null ? String(specs.step) : ''
    extra.thresholds.min = thresholds.min != null ? String(thresholds.min) : ''
    extra.thresholds.max = thresholds.max != null ? String(thresholds.max) : ''
    extra.thresholds.alarm = thresholds.alarm ?? false
    extra.attrsRows = Object.entries(attrs).map(([key, value]) => ({ key, value: String(value) }))
  }
  else {
    resetForm()
  }
}

watch(() => props.modelValue, (val) => {
  if (val) {
    prefill()
  }
})

function addAttrRow() {
  extra.attrsRows.push({ key: '', value: '' })
}

function removeAttrRow(index: number) {
  extra.attrsRows.splice(index, 1)
}

// 组装提交载荷：specs/thresholds/attrs 为空子键时省略
function buildSensorPayload(): SensorUpdatePayload {
  const payload: SensorUpdatePayload = {
    name: form.name.trim(),
    type: form.type,
    dataType: form.dataType as Sensor['dataType'],
    unit: form.unit.trim(),
    reportInterval: toNumber(extra.reportInterval) ?? 0,
    enabled: extra.enabled,
  }

  const specs: SensorSpecs = {}
  const min = toNumber(extra.specs.min)
  const max = toNumber(extra.specs.max)
  const step = toNumber(extra.specs.step)
  if (min != null) {
    specs.min = min
  }
  if (max != null) {
    specs.max = max
  }
  if (step != null) {
    specs.step = step
  }
  if (Object.keys(specs).length) {
    payload.specs = specs
  }

  const thresholds: SensorThresholds = {}
  const tMin = toNumber(extra.thresholds.min)
  const tMax = toNumber(extra.thresholds.max)
  if (tMin != null) {
    thresholds.min = tMin
  }
  if (tMax != null) {
    thresholds.max = tMax
  }
  if (extra.thresholds.alarm) {
    thresholds.alarm = true
  }
  if (Object.keys(thresholds).length) {
    payload.thresholds = thresholds
  }

  const attrs: Record<string, string> = {}
  extra.attrsRows.forEach((row) => {
    const key = row.key.trim()
    if (key) {
      attrs[key] = row.value
    }
  })
  if (Object.keys(attrs).length) {
    payload.attrs = attrs
  }

  return payload
}

// 弹窗关闭守卫：确认时先校验 + 提交，成功才关闭（失败保持弹窗可见，字段红字提示）
async function handleSensorClose(action: 'confirm' | 'cancel' | 'close', done: () => void) {
  if (action !== 'confirm') {
    done()
    return
  }
  // vee-validate 校验（字段错误由 FaFormItem 红字展示）
  const result = await formRef.value?.validate()
  if (result && !result.valid) {
    return
  }
  const ok = await submitSensor()
  if (ok) {
    done()
  }
}

// 提交（返回是否成功；成功时通知父级刷新详情数据源）
async function submitSensor(): Promise<boolean> {
  const deviceId = props.deviceId
  if (!deviceId) {
    return false
  }
  const payload = buildSensorPayload()
  saving.value = true
  try {
    if (props.mode === 'add') {
      const { name: nameVal, type: typeVal, ...restPayload } = payload
      const createPayload: SensorCreatePayload = {
        ...restPayload,
        id: form.id.trim(),
        name: nameVal ?? '',
        type: typeVal ?? '',
      }
      await sensorApi.create(deviceId, createPayload)
      useFaToast().success('传感器添加成功')
    }
    else {
      await sensorApi.update(deviceId, props.sensor!.id, payload)
      useFaToast().success('传感器更新成功')
    }
    emit('saved')
    return true
  }
  catch {
    useFaToast().error(props.mode === 'add' ? '传感器添加失败' : '传感器更新失败')
    return false
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <FaModal
    v-model="show" :title="mode === 'add' ? '添加传感器' : '编辑传感器'"
    show-cancel-button :confirm-button-loading="saving"
    :before-close="handleSensorClose" @confirm="show = false"
    @cancel="show = false"
  >
    <FaForm
      v-if="show"
      ref="formRef"
      :model="form"
      :validation-schema="validationSchema"
      class="gap-3 grid grid-cols-2 min-w-0"
    >
      <FaFormItem name="id" label="标识 (id)" class="col-span-1" required>
        <FaInput placeholder="如 temperature" :disabled="mode === 'edit'" class="w-full" />
      </FaFormItem>
      <FaFormItem name="name" label="名称" class="col-span-1" required>
        <FaInput placeholder="如：温度" class="w-full" />
      </FaFormItem>
      <FaFormItem name="type" label="类别" class="col-span-1" required>
        <FaSelect :options="typeOptions" class="w-full" />
        <span class="text-xs text-gray-400 pt-1">type 无后端枚举限制；固件需注册对应采集器（temperature 内置，其余按需扩展）</span>
      </FaFormItem>
      <FaFormItem name="dataType" label="数据类型" class="col-span-1" required>
        <FaSelect :options="dataTypeOptions" class="w-full" />
      </FaFormItem>
      <FaFormItem name="unit" label="单位" class="col-span-1">
        <FaInput placeholder="如：°C、%RH" class="w-full" />
      </FaFormItem>
      <div class="flex flex-col gap-1 col-span-1">
        <label class="text-sm font-medium">上报周期 (s)</label>
        <FaInput v-model="extra.reportInterval" type="number" placeholder="0 = 继承设备全局" class="w-full" />
      </div>
      <div class="flex gap-3 col-span-2 items-center">
        <label class="text-sm font-medium">启用</label>
        <FaSwitch v-model="extra.enabled" />
      </div>

      <!-- 量程 specs -->
      <div class="flex flex-col gap-1 col-span-2">
        <span class="text-sm font-medium">量程 (specs)</span>
        <div class="gap-3 grid grid-cols-3">
          <FaInput v-model="extra.specs.min" type="number" placeholder="min" class="w-full" />
          <FaInput v-model="extra.specs.max" type="number" placeholder="max" class="w-full" />
          <FaInput v-model="extra.specs.step" type="number" placeholder="step" class="w-full" />
        </div>
      </div>

      <!-- 阈值 thresholds -->
      <div class="flex flex-col gap-2 col-span-2">
        <span class="text-sm font-medium">告警阈值 (thresholds)</span>
        <div class="gap-3 grid grid-cols-2">
          <FaInput v-model="extra.thresholds.min" type="number" placeholder="min" class="w-full" />
          <FaInput v-model="extra.thresholds.max" type="number" placeholder="max" class="w-full" />
        </div>
        <div class="flex gap-3 items-center">
          <label class="text-sm font-medium">告警</label>
          <FaSwitch v-model="extra.thresholds.alarm" />
        </div>
      </div>

      <!-- 扩展属性 attrs（键值对动态行） -->
      <div class="flex flex-col gap-2 col-span-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">扩展属性 (attrs)</span>
          <FaButton variant="outline" size="sm" type="button" @click="addAttrRow">
            <FaIcon name="i-ri:add-line" class="mr-1 size-4" />
            添加属性
          </FaButton>
        </div>
        <div v-if="extra.attrsRows.length" class="flex flex-col gap-2">
          <div v-for="(row, index) in extra.attrsRows" :key="index" class="flex gap-2 items-center">
            <FaInput v-model="row.key" placeholder="key" class="w-40" />
            <FaInput v-model="row.value" placeholder="value" class="flex-1" />
            <FaButton variant="ghost" size="icon-sm" type="button" class="text-gray-400 hover:text-red-500" @click="removeAttrRow(index)">
              <FaIcon name="i-ri:close-line" class="size-4" />
            </FaButton>
          </div>
        </div>
        <span v-else class="text-xs text-gray-400">暂无扩展属性</span>
      </div>
    </FaForm>
  </FaModal>
</template>
