<script setup lang="ts">
import type { FormExpose } from '@fantastic-admin/components'
import type { Actuator, ActuatorCreatePayload, ActuatorDriver, ActuatorTransport, ActuatorUpdatePayload } from '@/api/modules/iot/actuator'
// 显式导入：避免 dev server 在 resolver 列表热更新前把 <FaCascader> 解析为空
import { FaCascader } from '@fantastic-admin/components'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { ACTUATOR_TRANSPORT_FIELDS, actuatorApi, actuatorDrivers, actuatorTransportLabels, actuatorTransports, epdChipPresets, epdScreenPresets } from '@/api/modules/iot/actuator'
import ActuatorSpecField from './ActuatorSpecField.vue'

defineOptions({
  name: 'ActuatorEditDialog',
})

const props = withDefaults(defineProps<{
  modelValue: boolean
  deviceId: string
  mode: 'add' | 'edit'
  actuator?: Actuator | null
}>(), {
  actuator: null,
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
// 与传感器弹窗同理：只把「走 FaForm/FaFormItem 自动绑定」的静态字段放进 :model，
// 动态 specs 参数与启用开关用独立 v-model 管理（extra），
// 避免 FaForm 双向同步时把未注册字段从 model 中删掉导致表单渲染崩溃。
const form = reactive({
  id: '',
  name: '',
  driver: 'led' as ActuatorDriver,
  transport: 'gpio' as ActuatorTransport,
})

const extra = reactive<{
  enabled: boolean
  // 表单编辑值（字符串输入 / 开关布尔），提交时按字段表转换
  specs: Record<string, any>
}>({
  enabled: true,
  specs: {},
})

const driverOptions = actuatorDrivers.map(driver => ({
  label: driver,
  value: driver,
}))

const transportOptions = actuatorTransports.map(transport => ({
  label: actuatorTransportLabels[transport],
  value: transport,
}))

// 当前 transport 的字段定义（驱动弹窗渲染与提交转换）
// ?? [] 兜底：字段表缺失时渲染为空字段，而不是让 for...of 抛错导致表单/下拉异常
const transportFields = computed(() => ACTUATOR_TRANSPORT_FIELDS[form.transport] ?? [])
// 基础区只渲染常用字段；advanced 字段由代码控制显隐（选中自定义时展开）
const basicTransportFields = computed(() => transportFields.value.filter(field => !field.advanced))
const advancedTransportFields = computed(() => transportFields.value.filter(field => field.advanced))
const showAdvancedSpecs = ref(false)

// EPD 屏幕尺寸：级联选择器（一级英寸 / 自定义，二级分辨率）
// 选中分辨率后把 size_inch / width / height 一起写入 specs
const epdCustomMode = ref(false)
const epdInches = computed(() => [...new Set(epdScreenPresets.map(preset => preset.inch))])

// 整数英寸补一位小数（2 → 2.0），其余保留原值（0.96 / 4.2 / 7.5）
function formatInch(inch: number): string {
  return inch % 1 === 0 ? inch.toFixed(1) : String(inch)
}

function presetKind(preset: { label: string }): string {
  const parts = preset.label.split('·')
  return parts[parts.length - 1]?.trim() ?? ''
}

const epdCascaderOptions = computed(() => [
  ...epdInches.value.map(inch => ({
    value: String(inch),
    label: `${formatInch(inch)} 英寸`,
    children: epdScreenPresets
      .filter(preset => preset.inch === inch)
      .map(preset => ({
        value: preset.key,
        label: `${preset.width}×${preset.height} · ${presetKind(preset)}`,
      })),
  })),
  { value: 'custom', label: '自定义（手动填写尺寸）' },
])

const epdSelectedInch = computed<number | 'custom'>(() => {
  const inch = Number(extra.specs.size_inch)
  return !epdCustomMode.value && epdInches.value.includes(inch) ? inch : 'custom'
})

const epdSelectedResolutionKey = computed(() => {
  const inch = Number(extra.specs.size_inch)
  const width = Number(extra.specs.width)
  const height = Number(extra.specs.height)
  return epdScreenPresets.find(preset =>
    preset.inch === inch && preset.width === width && preset.height === height,
  )?.key ?? ''
})

const epdCascaderValue = computed<string[]>({
  get() {
    if (epdSelectedInch.value === 'custom') {
      return ['custom']
    }
    const inch = String(epdSelectedInch.value)
    return epdSelectedResolutionKey.value
      ? [inch, epdSelectedResolutionKey.value]
      : [inch]
  },
  set(path) {
    onEpdCascaderChange(path)
  },
})

// 固件 display_check_cfg 会把 width/height/chip/color_depth 与探测到的面板逐项比对，
// 任一不符整块墨水屏都加载失败 → 换预设必须连面板标识一起改，不能只改分辨率。
function applyEpdPreset(preset: (typeof epdScreenPresets)[number]) {
  extra.specs.size_inch = String(preset.inch)
  extra.specs.width = String(preset.width)
  extra.specs.height = String(preset.height)
  // 已知面板型号：带出芯片与色深
  if (preset.chip) {
    extra.specs.chip = preset.chip
  }
  else {
    // 通用面板：清掉上一条预设残留的芯片，避免「新分辨率 + 旧芯片」的非法组合
    delete extra.specs.chip
  }
  if (preset.colorDepth) {
    extra.specs.color_depth = preset.colorDepth
  }
}

function onEpdCascaderChange(value: unknown) {
  const path = Array.isArray(value)
    ? value.map(item => String(item))
    : (value != null ? [String(value)] : [])
  if (path.length === 0 || path[0] === 'custom') {
    epdCustomMode.value = true
    // 自定义需要手填英寸/宽高，自动展开高级选项
    showAdvancedSpecs.value = true
    return
  }
  const inch = Number(path[0])
  const key = path[1]
  const preset = (key ? epdScreenPresets.find(item => item.key === key) : undefined)
    ?? epdScreenPresets.find(item => item.inch === inch)
  if (!preset) {
    epdCustomMode.value = true
    showAdvancedSpecs.value = true
    return
  }
  epdCustomMode.value = false
  applyEpdPreset(preset)
  // 预设未带出芯片时必须保留高级区：chip 是必填项，收起后用户既看不到也改不了
  showAdvancedSpecs.value = !preset.chip
}

// 编辑中的旧版定义（specs 无 transport 字段）提示升级
const editingLegacyActuator = ref(false)

const validationSchema = toTypedSchema(z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{0,10}$/, '小写字母开头，仅含小写字母/数字/下划线，≤11 字符'),
  name: z.string().max(100, '名称最多 100 字符'),
  transport: z.string().min(1, '请选择设备类型'),
  driver: z.string().min(1, '请选择兼容标识'),
}))

function resetConfigFields() {
  showAdvancedSpecs.value = false
  Object.keys(extra.specs).forEach((key) => {
    delete extra.specs[key]
  })
  for (const field of transportFields.value) {
    if (field.default !== undefined) {
      extra.specs[field.key] = field.type === 'bool'
        ? Boolean(field.default)
        : String(field.default)
    }
    else if (field.type === 'bool') {
      extra.specs[field.key] = true
    }
  }
  epdCustomMode.value = false
}

function prefill() {
  showAdvancedSpecs.value = false
  if (props.mode === 'edit' && props.actuator) {
    const act = props.actuator
    form.id = act.id
    form.name = act.name ?? ''
    form.driver = act.driver
    const legacy = !act.specs?.transport
    editingLegacyActuator.value = legacy
    form.transport = legacy
      ? 'gpio'
      : (actuatorTransports.includes(act.specs!.transport) ? act.specs!.transport : 'gpio')
    extra.enabled = act.enabled ?? true
    resetConfigFields()
    const specsMap = act.specs ?? {}
    for (const field of transportFields.value) {
      if (specsMap[field.key] != null) {
        extra.specs[field.key] = field.type === 'bool'
          ? Boolean(specsMap[field.key])
          : String(specsMap[field.key])
      }
    }
    // 存量自定义尺寸（不匹配任何预设）自动展开，便于直接修改
    if (form.transport === 'epd') {
      showAdvancedSpecs.value = !epdSelectedResolutionKey.value
    }
  }
  else {
    form.id = ''
    form.name = ''
    form.driver = 'led'
    form.transport = 'gpio'
    extra.enabled = true
    editingLegacyActuator.value = false
    resetConfigFields()
  }
}

// 新增时切换 transport → 参数回默认（编辑时保留已加载配置）
watch(() => form.transport, () => {
  if (props.mode === 'add') {
    resetConfigFields()
  }
})

// EPD：新增时填写已知芯片型号 → 自动带出对应分辨率与默认色深
watch(() => extra.specs.chip, (chip) => {
  if (props.mode !== 'add' || form.transport !== 'epd') {
    return
  }
  const preset = epdChipPresets[String(chip ?? '').toLowerCase()]
  if (!preset) {
    return
  }
  extra.specs.size_inch = String(preset.sizeInch)
  extra.specs.width = String(preset.width)
  extra.specs.height = String(preset.height)
  extra.specs.color_depth = preset.colorDepth
  epdCustomMode.value = false
  showAdvancedSpecs.value = false
})

watch(() => props.modelValue, (val) => {
  if (val) {
    prefill()
  }
})

// 弹窗关闭守卫：确认时先校验 + 提交，成功才关闭（失败保持弹窗可见）
async function handleBeforeClose(action: 'confirm' | 'cancel' | 'close', done: () => void) {
  if (action !== 'confirm') {
    done()
    return
  }
  const result = await formRef.value?.validate()
  if (result && !result.valid) {
    return
  }
  const ok = await onSubmit()
  if (ok) {
    done()
  }
}

async function onSubmit(): Promise<boolean> {
  const deviceId = props.deviceId
  if (!deviceId) {
    return false
  }
  const id = form.id.trim()
  if (!/^[a-z][a-z0-9_]{0,10}$/.test(id)) {
    useFaToast().warning('标识需小写字母开头，仅含小写字母/数字/下划线，≤11 字符')
    return false
  }

  // 组装 specs：transport 固定注入，字段按当前 transport 的表驱动转换
  const specs: Record<string, any> = { transport: form.transport }
  for (const field of transportFields.value) {
    const raw = extra.specs[field.key]
    if (field.type === 'bool') {
      specs[field.key] = Boolean(raw)
      continue
    }
    if (field.type === 'select') {
      const sel = String(raw ?? '').trim()
      if (sel !== '') {
        const num = Number(sel)
        specs[field.key] = Number.isNaN(num) ? sel : num
      }
      continue
    }
    if (field.type === 'text') {
      const text = String(raw ?? '').trim()
      if (text === '') {
        if (field.required) {
          useFaToast().warning(`${field.label} 为必填`)
          return false
        }
        continue
      }
      specs[field.key] = text
      continue
    }
    const trimmed = String(raw ?? '').trim()
    if (trimmed === '') {
      if (field.required) {
        useFaToast().warning(`${field.label} 为必填`)
        return false
      }
      continue
    }
    const num = Number(trimmed)
    if (Number.isNaN(num)) {
      useFaToast().warning(`${field.label} 需为数字`)
      return false
    }
    specs[field.key] = num
  }

  const common = {
    name: form.name.trim(),
    enabled: extra.enabled,
  }
  saving.value = true
  try {
    if (props.mode === 'add') {
      const payload: ActuatorCreatePayload = {
        id,
        driver: form.driver,
        ...common,
        specs,
      }
      await actuatorApi.create(deviceId, payload)
      useFaToast().success('执行器添加成功')
    }
    else {
      const payload: ActuatorUpdatePayload = { ...common, specs }
      await actuatorApi.update(deviceId, props.actuator!.id, payload)
      useFaToast().success('执行器更新成功')
    }
    emit('saved')
    return true
  }
  catch {
    useFaToast().error(props.mode === 'add' ? '执行器添加失败' : '执行器更新失败')
    return false
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <FaModal
    v-model="show" :title="mode === 'add' ? '添加执行器' : '编辑执行器'"
    show-cancel-button :confirm-button-loading="saving"
    :before-close="handleBeforeClose" @confirm="show = false"
    @cancel="show = false"
  >
    <div class="py-2 flex flex-col gap-4 min-w-0">
      <div v-if="editingLegacyActuator" class="text-xs text-amber-500">
        旧版驱动模型定义，保存后将升级为 transport 模型（specs.transport）
      </div>
      <FaForm
        v-if="show"
        ref="formRef"
        :model="form"
        :validation-schema="validationSchema"
        class="gap-3 grid grid-cols-1 min-w-0 sm:grid-cols-2"
      >
        <FaFormItem
          name="id" label="标识 (id)" class="sm:col-span-2" required
          description="小写字母开头，≤11 字符；= 设备侧控制命令 action"
        >
          <FaInput placeholder="如：relay1、fan1" :disabled="mode === 'edit'" class="w-full" />
        </FaFormItem>
        <FaFormItem name="name" label="名称（可选）" class="sm:col-span-2">
          <FaInput placeholder="如：继电器" class="w-full" />
        </FaFormItem>
        <FaFormItem name="transport" label="设备类型 (transport)" class="col-span-1" required>
          <FaSelect :options="transportOptions" class="w-full" />
        </FaFormItem>
        <FaFormItem name="driver" label="兼容标识 (driver)" class="col-span-1" required>
          <FaSelect
            :options="driverOptions"
            :disabled="mode === 'edit'" class="w-full"
          />
        </FaFormItem>

        <div class="flex flex-col gap-2 sm:col-span-2">
          <span class="text-sm font-medium">参数 (specs)</span>
          <div class="gap-3 grid grid-cols-1 sm:grid-cols-2">
            <ActuatorSpecField
              v-for="field in basicTransportFields"
              :key="field.key"
              v-model="extra.specs[field.key]"
              :field="field"
            />
            <!-- EPD：级联选择（一级英寸/自定义，二级分辨率），选中后写入 size_inch/width/height -->
            <div v-if="form.transport === 'epd'" class="flex flex-col gap-1">
              <label class="text-sm text-gray-400">屏幕尺寸</label>
              <FaCascader
                v-model="epdCascaderValue"
                :options="epdCascaderOptions"
                separator="/"
                placeholder="选择尺寸与分辨率"
                class="w-full"
              />
              <span v-if="epdSelectedInch === 'custom'" class="text-xs text-gray-400">
                自定义尺寸请填写下方的英寸、宽度与高度
              </span>
            </div>
          </div>
          <!-- 高级参数由代码控制显隐（选「自定义」时自动展开），不提供手动开关 -->
          <div
            v-if="showAdvancedSpecs && advancedTransportFields.length"
            class="pt-2 gap-3 grid grid-cols-1 sm:col-span-2 sm:grid-cols-2"
          >
            <ActuatorSpecField
              v-for="field in advancedTransportFields"
              :key="field.key"
              v-model="extra.specs[field.key]"
              :field="field"
            />
          </div>
        </div>

        <div class="flex gap-3 items-center sm:col-span-2">
          <label class="text-sm font-medium">启用</label>
          <FaSwitch v-model="extra.enabled" />
        </div>
      </FaForm>
    </div>
  </FaModal>
</template>
