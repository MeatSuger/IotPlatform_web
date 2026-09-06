<script setup lang="ts">
import type { FormExpose } from '@fantastic-admin/components'
import type { DeviceConfigPayload } from '@/api/modules/iot/control'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { controlApi } from '@/api/modules/iot/control'
import { deviceApi } from '@/api/modules/iot/device'

defineOptions({
  name: 'DeviceEditDialog',
})

const props = withDefaults(defineProps<{
  modelValue: boolean
  device?: DeviceBasic | null
  // 是否展示「高级配置」（DeviceConfig 分区），默认收起
  advanced?: boolean
}>(), {
  device: null,
  advanced: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
}>()

// 基础资料（用于弹窗内只读标识与预填）
export interface DeviceBasic {
  deviceId: string
  deviceName: string
  deviceType: string
  firmwareVersion?: string
  ipAddress?: string
  macAddress?: string
  location?: string
}

const formRef = useTemplateRef<FormExpose>('formRef')
const show = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const saving = ref(false)
const loading = ref(false)
const advancedOpen = ref(false)
const advancedDirty = ref(false)

// ==================== 基础资料 ====================
const model = ref<Omit<DeviceBasic, 'deviceId'> & { deviceId: string }>({
  deviceId: '',
  deviceName: '',
  deviceType: '',
  firmwareVersion: '',
  ipAddress: '',
  macAddress: '',
  location: '',
})

const validationSchema = toTypedSchema(z.object({
  deviceName: z.string().min(1, '请输入设备名称').max(100, '名称最多 100 字符'),
  deviceType: z.string().min(1, '请选择设备类型'),
  firmwareVersion: z.string().max(50, '固件版本最多 50 字符'),
  ipAddress: z.string().max(45, 'IP 地址过长'),
  macAddress: z.string().max(17, 'MAC 地址过长'),
  location: z.string().max(255, '位置最多 255 字符'),
}))

const deviceTypeOptions = [
  { label: '温度(°C)', value: 'temperature' },
  { label: '湿度(%RH)', value: 'humidity' },
  { label: '网关', value: 'gateway' },
  { label: '环境监测', value: 'environment' },
  { label: 'ESP32', value: 'ESP32' },
]

// ==================== 高级配置（DeviceConfig 分区，可选） ====================
const configForm = reactive({
  wifiSsid: '',
  wifiPassword: '',
  mqttHost: '',
  mqttPort: '1883',
  mqttTls: false,
  reportInterval: '60',
  tempMin: '',
  tempMax: '',
  actuatorMode: 'auto',
  smtpHost: '',
  smtpPort: '465',
  smtpSsl: true,
  smtpUsername: '',
  smtpPassword: '',
  snapshotInterval: '30',
})

const actuatorModeOptions = [
  { label: '自动', value: 'auto' },
  { label: '手动', value: 'manual' },
]

function toNum(value: string): number | undefined {
  const num = Number(value)
  return Number.isNaN(num) || value === '' ? undefined : num
}

function applyConfigPayload(payload: DeviceConfigPayload | null | undefined) {
  const network = payload?.network
  const sensor = payload?.sensor
  const actuator = payload?.actuator
  const camera = payload?.camera
  configForm.wifiSsid = network?.wifi?.ssid ?? ''
  configForm.wifiPassword = network?.wifi?.password ?? ''
  configForm.mqttHost = network?.mqtt?.host ?? ''
  configForm.mqttPort = network?.mqtt?.port != null ? String(network.mqtt.port) : '1883'
  configForm.mqttTls = network?.mqtt?.tls ?? false
  configForm.reportInterval = sensor?.reportInterval != null ? String(sensor.reportInterval) : '60'
  configForm.tempMin = sensor?.thresholds?.temperature?.min != null ? String(sensor.thresholds.temperature.min) : ''
  configForm.tempMax = sensor?.thresholds?.temperature?.max != null ? String(sensor.thresholds.temperature.max) : ''
  configForm.actuatorMode = actuator?.mode ?? 'auto'
  configForm.smtpHost = camera?.smtp?.host ?? ''
  configForm.smtpPort = camera?.smtp?.port != null ? String(camera.smtp.port) : '465'
  configForm.smtpSsl = camera?.smtp?.ssl ?? true
  configForm.smtpUsername = camera?.smtp?.username ?? ''
  configForm.smtpPassword = camera?.smtp?.password ?? ''
  configForm.snapshotInterval = camera?.snapshotInterval != null ? String(camera.snapshotInterval) : '30'
}

function buildConfigPayload(): DeviceConfigPayload {
  const payload: DeviceConfigPayload = {}

  const network: NonNullable<DeviceConfigPayload['network']> = {}
  if (configForm.wifiSsid || configForm.wifiPassword) {
    network.wifi = { ssid: configForm.wifiSsid, password: configForm.wifiPassword }
  }
  if (configForm.mqttHost) {
    network.mqtt = { host: configForm.mqttHost, port: toNum(configForm.mqttPort), tls: configForm.mqttTls }
  }
  if (Object.keys(network).length) {
    payload.network = network
  }

  const sensor: NonNullable<DeviceConfigPayload['sensor']> = {}
  if (configForm.reportInterval !== '60' || configForm.tempMin || configForm.tempMax) {
    if (configForm.reportInterval !== '60') {
      sensor.reportInterval = toNum(configForm.reportInterval)
    }
    const temperature: { min?: number, max?: number } = {}
    if (configForm.tempMin) {
      temperature.min = toNum(configForm.tempMin)
    }
    if (configForm.tempMax) {
      temperature.max = toNum(configForm.tempMax)
    }
    if (Object.keys(temperature).length) {
      sensor.thresholds = { temperature }
    }
  }
  if (Object.keys(sensor).length) {
    payload.sensor = sensor
  }

  if (configForm.actuatorMode !== 'auto') {
    payload.actuator = { mode: configForm.actuatorMode }
  }

  const camera: NonNullable<DeviceConfigPayload['camera']> = {}
  if (configForm.smtpHost) {
    camera.protocol = 'smtp'
    camera.smtp = {
      host: configForm.smtpHost,
      port: toNum(configForm.smtpPort),
      ssl: configForm.smtpSsl,
      username: configForm.smtpUsername,
      password: configForm.smtpPassword,
    }
  }
  if (configForm.snapshotInterval !== '30') {
    camera.snapshotInterval = toNum(configForm.snapshotInterval)
  }
  if (Object.keys(camera).length) {
    payload.camera = camera
  }

  return payload
}

// 高级区任意输入变化即标记 dirty
watch(
  () => JSON.stringify(configForm),
  () => {
    advancedDirty.value = true
  },
)

// ==================== 打开 / 预填 ====================
async function openDialog() {
  loading.value = true
  advancedOpen.value = false
  const source = props.device
  if (source) {
    Object.assign(model.value, {
      deviceId: source.deviceId,
      deviceName: source.deviceName || '',
      deviceType: source.deviceType || '',
      firmwareVersion: source.firmwareVersion ?? '',
      ipAddress: source.ipAddress ?? '',
      macAddress: source.macAddress ?? '',
      location: source.location ?? '',
    })
  }
  else {
    model.value.deviceId = ''
  }
  if (props.advanced && model.value.deviceId) {
    try {
      const res: any = await deviceApi.getDetail(model.value.deviceId)
      const data = res?.data?.data ?? res?.data
      if (data) {
        Object.assign(model.value, {
          deviceName: data.deviceName || '',
          deviceType: data.deviceType || '',
          firmwareVersion: data.firmwareVersion ?? '',
          ipAddress: data.ipAddress ?? '',
          macAddress: data.macAddress ?? '',
          location: data.location ?? '',
        })
      }
      const cfgRes: any = await controlApi.getConfig(model.value.deviceId)
      const config = cfgRes?.data?.data ?? cfgRes?.data
      applyConfigPayload(config?.payload)
    }
    catch {
      // 配置拉取失败不阻塞基础资料编辑
    }
  }
  // 预填完成后重置脏标记（避免把预填写入当作修改）
  advancedDirty.value = false
  loading.value = false
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      openDialog()
    }
  },
  { immediate: true },
)

// ==================== 提交 ====================
// 弹窗关闭守卫：先 vee 校验，再提交；成功才关闭（避免 FaModal 先销毁表单导致提交静默失败）
async function handleBeforeClose(action: 'confirm' | 'cancel' | 'close', done: () => void) {
  if (action !== 'confirm') {
    done()
    return
  }
  const result = await formRef.value?.validate()
  if (result && !result.valid) {
    return
  }
  if (await onSubmit()) {
    done()
  }
}

async function onSubmit(): Promise<boolean> {
  const deviceId = model.value.deviceId
  if (!deviceId) {
    return false
  }
  saving.value = true
  try {
    const basic = {
      deviceName: model.value.deviceName,
      deviceType: model.value.deviceType,
      firmwareVersion: model.value.firmwareVersion || undefined,
      ipAddress: model.value.ipAddress || undefined,
      macAddress: model.value.macAddress || undefined,
      location: model.value.location || undefined,
    }
    await deviceApi.update(deviceId, basic)
    useFaToast().success('设备更新成功')

    if (props.advanced && advancedDirty.value) {
      await controlApi.setConfig(deviceId, buildConfigPayload())
      useFaToast().success('高级配置已保存并下发')
    }
    emit('saved')
    return true
  }
  catch {
    useFaToast().error('保存失败')
    return false
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <FaModal
    v-model="show" title="编辑设备" show-cancel-button
    :confirm-button-loading="saving" :before-close="handleBeforeClose" @confirm="show = false"
  >
    <div v-loading="loading" class="py-2 flex flex-col gap-4 min-w-0">
      <div class="text-xs text-gray-400">
        设备 ID：{{ model.deviceId }}
      </div>
      <FaForm
        v-if="show && !loading"
        ref="formRef"
        :model="model"
        :validation-schema="validationSchema"
        class="gap-3 grid grid-cols-1 min-w-0 sm:grid-cols-2"
        @submit="onSubmit"
      >
        <FaFormItem name="deviceName" label="设备名称" required>
          <FaInput placeholder="请输入设备名称" class="w-full" />
        </FaFormItem>
        <FaFormItem name="deviceType" label="设备类型" required>
          <FaSelect :options="deviceTypeOptions" placeholder="请选择设备类型" class="w-full" />
        </FaFormItem>
        <FaFormItem name="firmwareVersion" label="固件版本">
          <FaInput placeholder="请输入固件版本" class="w-full" />
        </FaFormItem>
        <FaFormItem name="ipAddress" label="IP 地址">
          <FaInput placeholder="请输入 IP 地址" class="w-full" />
        </FaFormItem>
        <FaFormItem name="macAddress" label="MAC 地址">
          <FaInput placeholder="请输入 MAC 地址" class="w-full" />
        </FaFormItem>
        <FaFormItem name="location" label="位置">
          <FaInput placeholder="请输入设备位置（可选）" class="w-full" />
        </FaFormItem>
      </FaForm>

      <!-- 高级配置（DeviceConfig 分区，默认收起） -->
      <div v-if="advanced" class="pt-3 border-t min-w-0">
        <FaButton variant="ghost" size="sm" type="button" class="-mx-2" @click="advancedOpen = !advancedOpen">
          <FaIcon :name="advancedOpen ? 'i-ri:arrow-up-s-line' : 'i-ri:arrow-down-s-line'" class="size-3.5" />
          高级配置
        </FaButton>
        <div v-if="advancedOpen" class="pt-3 flex flex-col gap-4 min-w-0">
          <div class="flex flex-col gap-2">
            <div class="text-sm text-muted-foreground font-semibold">
              网络 (network)
            </div>
            <div class="gap-3 grid grid-cols-1 min-w-0 sm:grid-cols-2">
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">WiFi SSID</label>
                <FaInput v-model="configForm.wifiSsid" placeholder="如：MyWiFi" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">WiFi 密码</label>
                <FaInput v-model="configForm.wifiPassword" type="password" placeholder="WiFi 密码" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">MQTT Host</label>
                <FaInput v-model="configForm.mqttHost" placeholder="如：broker.example.com" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">MQTT Port</label>
                <FaInput v-model="configForm.mqttPort" placeholder="1883" class="w-full" />
              </div>
            </div>
            <FaCheckbox v-model="configForm.mqttTls">
              MQTT TLS
            </FaCheckbox>
          </div>

          <div class="flex flex-col gap-2">
            <div class="text-sm text-muted-foreground font-semibold">
              传感器 (sensor)
            </div>
            <div class="gap-3 grid grid-cols-1 min-w-0 sm:grid-cols-3">
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">上报间隔 (s)</label>
                <FaInput v-model="configForm.reportInterval" placeholder="60" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">温度下限 (°C)</label>
                <FaInput v-model="configForm.tempMin" placeholder="0" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">温度上限 (°C)</label>
                <FaInput v-model="configForm.tempMax" placeholder="100" class="w-full" />
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <div class="text-sm text-muted-foreground font-semibold">
              执行器 (actuator)
            </div>
            <div class="flex flex-col gap-1 min-w-0 w-full sm:w-1/2">
              <label class="text-sm font-medium">模式</label>
              <FaSelect v-model="configForm.actuatorMode" :options="actuatorModeOptions" class="w-full" />
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <div class="text-sm text-muted-foreground font-semibold">
              摄像头 (camera)
            </div>
            <div class="gap-3 grid grid-cols-1 min-w-0 sm:grid-cols-2">
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">SMTP Host</label>
                <FaInput v-model="configForm.smtpHost" placeholder="如：smtp.example.com" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">SMTP Port</label>
                <FaInput v-model="configForm.smtpPort" placeholder="465" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">SMTP 用户名</label>
                <FaInput v-model="configForm.smtpUsername" placeholder="邮箱账号" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">SMTP 密码</label>
                <FaInput v-model="configForm.smtpPassword" type="password" placeholder="授权码" class="w-full" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">抓拍间隔 (s)</label>
                <FaInput v-model="configForm.snapshotInterval" placeholder="30" class="w-full" />
              </div>
            </div>
            <FaCheckbox v-model="configForm.smtpSsl">
              SMTP SSL
            </FaCheckbox>
          </div>
        </div>
      </div>
    </div>
  </FaModal>
</template>
