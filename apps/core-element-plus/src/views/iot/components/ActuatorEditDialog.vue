<script setup lang="ts">
import type { FormExpose } from '@fantastic-admin/components'
import type { Actuator, ActuatorCreatePayload, ActuatorDriver, ActuatorTransport, ActuatorUpdatePayload } from '@/api/modules/iot/actuator'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { ACTUATOR_TRANSPORT_FIELDS, actuatorApi, actuatorDrivers, actuatorTransportLabels, actuatorTransports } from '@/api/modules/iot/actuator'

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
// 动态 config 参数与启用开关用独立 v-model 管理（extra），
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
  config: Record<string, any>
}>({
  enabled: true,
  config: {},
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
const transportFields = computed(() => ACTUATOR_TRANSPORT_FIELDS[form.transport])

// 编辑中的旧版定义（config 无 transport 字段）提示升级
const editingLegacyActuator = ref(false)

const validationSchema = toTypedSchema(z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{0,10}$/, '小写字母开头，仅含小写字母/数字/下划线，≤11 字符'),
  name: z.string().max(100, '名称最多 100 字符'),
  transport: z.string().min(1, '请选择设备类型'),
  driver: z.string().min(1, '请选择兼容标识'),
}))

function resetConfigFields() {
  Object.keys(extra.config).forEach((key) => {
    delete extra.config[key]
  })
  for (const field of ACTUATOR_TRANSPORT_FIELDS[form.transport]) {
    if (field.default !== undefined) {
      extra.config[field.key] = field.type === 'bool'
        ? Boolean(field.default)
        : String(field.default)
    }
    else if (field.type === 'bool') {
      extra.config[field.key] = true
    }
  }
}

function prefill() {
  if (props.mode === 'edit' && props.actuator) {
    const act = props.actuator
    form.id = act.id
    form.name = act.name ?? ''
    form.driver = act.driver
    const legacy = !act.config?.transport
    editingLegacyActuator.value = legacy
    form.transport = legacy
      ? 'gpio'
      : (actuatorTransports.includes(act.config!.transport) ? act.config!.transport : 'gpio')
    extra.enabled = act.enabled ?? true
    resetConfigFields()
    const config = act.config ?? {}
    for (const field of transportFields.value) {
      if (config[field.key] != null) {
        extra.config[field.key] = field.type === 'bool'
          ? Boolean(config[field.key])
          : String(config[field.key])
      }
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

  // 组装 config：transport 固定注入，字段按当前 transport 的表驱动转换
  const config: Record<string, any> = { transport: form.transport }
  for (const field of transportFields.value) {
    const raw = extra.config[field.key]
    if (field.type === 'bool') {
      config[field.key] = Boolean(raw)
      continue
    }
    if (field.type === 'select') {
      const sel = String(raw ?? '').trim()
      if (sel !== '') {
        const num = Number(sel)
        config[field.key] = Number.isNaN(num) ? sel : num
      }
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
    config[field.key] = num
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
        config,
      }
      await actuatorApi.create(deviceId, payload)
      useFaToast().success('执行器添加成功')
    }
    else {
      const payload: ActuatorUpdatePayload = { ...common, config }
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
        旧版驱动模型定义，保存后将升级为 transport 模型（config.transport）
      </div>
      <FaForm
        v-if="show"
        ref="formRef"
        :model="form"
        :validation-schema="validationSchema"
        class="gap-3 grid grid-cols-2 min-w-0"
      >
        <FaFormItem
          name="id" label="标识 (id)" class="col-span-2" required
          description="小写字母开头，≤11 字符；= 设备侧控制命令 action"
        >
          <FaInput placeholder="如：relay1、fan1" :disabled="mode === 'edit'" class="w-full" />
        </FaFormItem>
        <FaFormItem name="name" label="名称（可选）" class="col-span-2">
          <FaInput placeholder="如：继电器" class="w-full" />
        </FaFormItem>
        <FaFormItem name="transport" label="设备类型 (transport)" class="col-span-1" required>
          <FaSelect :options="transportOptions" class="w-full" />
        </FaFormItem>
        <FaFormItem
          name="driver" label="兼容标识 (driver)" class="col-span-1" required
          description="后端枚举占位（led/servo/speaker），固件忽略，仅需通过后端校验"
        >
          <FaSelect
            :options="driverOptions"
            :disabled="mode === 'edit'" class="w-full"
          />
        </FaFormItem>

        <div class="flex flex-col gap-2 col-span-2">
          <span class="text-sm font-medium">参数 (config)</span>
          <div class="gap-3 grid grid-cols-2">
            <template v-for="field in transportFields" :key="field.key">
              <div v-if="field.type === 'bool'" class="flex gap-3 col-span-2 items-center">
                <FaSwitch v-model="extra.config[field.key]" />
                <span class="text-sm text-gray-400">{{ field.label }}<span v-if="field.hint">（{{ field.hint }}）</span></span>
              </div>
              <div v-else-if="field.type === 'select'" class="flex flex-col gap-1">
                <label class="text-sm text-gray-400">{{ field.label }}<span v-if="field.required"> *</span></label>
                <FaSelect v-model="extra.config[field.key]" :options="field.options ?? []" class="w-full" />
              </div>
              <div v-else class="flex flex-col gap-1">
                <label class="text-sm text-gray-400">{{ field.label }}<span v-if="field.required"> *</span></label>
                <FaInput v-model="extra.config[field.key]" type="number" :placeholder="field.hint ?? '默认值'">
                  <template v-if="field.unit" #end>
                    <span class="text-xs text-gray-400">{{ field.unit }}</span>
                  </template>
                </FaInput>
              </div>
            </template>
          </div>
          <span class="text-xs text-gray-400">必填项需填写；其余留空使用默认值（固件约定，见 docs/mqtt-api.md）</span>
        </div>

        <div class="flex gap-3 col-span-2 items-center">
          <label class="text-sm font-medium">启用</label>
          <FaSwitch v-model="extra.enabled" />
        </div>
      </FaForm>
    </div>
  </FaModal>
</template>
