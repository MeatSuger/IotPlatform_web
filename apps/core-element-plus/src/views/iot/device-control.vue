<script setup lang="ts">
import type { TableColumn } from '@fantastic-admin/components'
import type { DeviceConfig, DeviceConfigPayload, DeviceDetail, SensorItem } from '@/api/modules/iot/control'
import type { ControllerItem, ControllerType } from '@/store/modules/controller'
import { controlApi } from '@/api/modules/iot/control'
import { deviceApi } from '@/api/modules/iot/device'
import { useDeviceWebSocket } from '@/composables/useDeviceWebSocket'

defineOptions({ name: 'DeviceControl' })

const router = useRouter()
const route = useRoute()

// ==================== WebSocket ====================
const {
  isConnected: wsConnected,
  sendCommand: wsSend,
  connect: wsConnect,
  disconnect: wsDisconnect,
  lastResponse: wsLastResponse,
} = useDeviceWebSocket()

// ==================== 设备列表 ====================
interface DeviceRow {
  deviceId: string
  deviceName: string
  deviceType: string
  status: 'ONLINE' | 'OFFLINE'
  lastActiveTime: string
}
const deviceList = ref<DeviceRow[]>([])
const listLoading = ref(false)

const deviceColumns: TableColumn<DeviceRow>[] = [
  { accessorKey: 'deviceId', header: '设备ID', width: 120 },
  { accessorKey: 'deviceName', header: '设备名称', minWidth: 140 },
  { accessorKey: 'deviceType', header: '设备类型', width: 100, align: 'center' },
  { accessorKey: 'status', header: '状态', width: 80, align: 'center' },
  { accessorKey: 'lastActiveTime', header: '最后活跃', width: 170, align: 'center' },
]

// ==================== 设备详情 ====================
const viewMode = ref<'list' | 'detail'>('list')
const selectedDetail = ref<DeviceDetail | null>(null)
const detailLoading = ref(false)
const lastRefreshTime = ref('')

async function fetchDetail(deviceId: string): Promise<DeviceDetail> {
  const res = await controlApi.getDetail(deviceId)
  const data = res?.data?.data ?? res?.data
  return data as DeviceDetail
}

async function enterDetail(deviceId: string) {
  detailLoading.value = true
  try {
    selectedDetail.value = await fetchDetail(deviceId)
    viewMode.value = 'detail'
    lastRefreshTime.value = new Date().toLocaleTimeString()
  }
  catch {
    useFaToast().error('获取设备详情失败')
  }
  finally {
    detailLoading.value = false
  }
}

async function refreshDetail(silent = false) {
  if (!selectedDetail.value) {
    return
  }
  const deviceId = selectedDetail.value.deviceId
  if (!silent) {
    detailLoading.value = true
  }
  try {
    selectedDetail.value = await fetchDetail(deviceId)
    lastRefreshTime.value = new Date().toLocaleTimeString()
    if (!silent) {
      useFaToast().success('刷新成功')
    }
  }
  catch {
    if (!silent) {
      useFaToast().error('刷新失败')
    }
  }
  finally {
    if (!silent) {
      detailLoading.value = false
    }
  }
}

function backToList() {
  // 从设备列表等外部页面通过「编辑」带 deviceId 进入时，返回上一页（从哪来回哪去）
  if (route.query.deviceId) {
    router.back()
    return
  }
  viewMode.value = 'list'
  selectedDetail.value = null
}

// ==================== 添加传感器 ====================
// 本地新增的传感器按 deviceId 暂存（与后端/自动刷新返回的数据合并展示，避免被刷新覆盖）
const localSensorsMap = reactive<Record<string, SensorItem[]>>({})

const showAddSensorDialog = ref(false)
const sensorForm = reactive({
  name: '',
  identifier: '',
  transferType: '只上报',
  dataType: '浮点型',
  unit: '',
})

const sensorTypeOptions = [
  { label: '浮点型', value: '浮点型' },
  { label: '整数型', value: '整数型' },
  { label: '字符型', value: '字符型' },
  { label: '布尔型', value: '布尔型' },
]

const transferTypeOptions = [
  { label: '只上报', value: '只上报' },
  { label: '上报和下发', value: '上报和下发' },
]

const displaySensors = computed<SensorItem[]>(() => {
  const server = selectedDetail.value?.sensors ?? []
  const local = selectedDetail.value?.deviceId ? (localSensorsMap[selectedDetail.value.deviceId] ?? []) : []
  const merged = [...server]
  local.forEach((sensor) => {
    if (!merged.some(item => item.identifier === sensor.identifier)) {
      merged.push(sensor)
    }
  })
  return merged
})

function openAddSensorDialog() {
  sensorForm.name = ''
  sensorForm.identifier = ''
  sensorForm.transferType = '只上报'
  sensorForm.dataType = '浮点型'
  sensorForm.unit = ''
  showAddSensorDialog.value = true
}

function addSensor() {
  const deviceId = selectedDetail.value?.deviceId
  if (!deviceId) {
    return
  }
  if (!sensorForm.name.trim() || !sensorForm.identifier.trim()) {
    useFaToast().warning('请填写名称和标识名')
    return
  }
  if (!localSensorsMap[deviceId]) {
    localSensorsMap[deviceId] = []
  }
  localSensorsMap[deviceId].push({
    name: sensorForm.name.trim(),
    identifier: sensorForm.identifier.trim(),
    transferType: sensorForm.transferType,
    dataType: sensorForm.dataType,
    unit: sensorForm.unit.trim() || undefined,
    value: '',
  })
  showAddSensorDialog.value = false
  useFaToast().success('传感器添加成功')
}

// ==================== 设备配置（DeviceConfig 快照） ====================
const showConfigDialog = ref(false)
const configLoading = ref(false)
const configSaving = ref(false)
const configVersion = ref(0)
const configStatus = ref('')

const configForm = reactive({
  wifiSsid: '',
  wifiPassword: '',
  mqttHost: '',
  mqttPort: '1883',
  mqttTls: false,
  reportInterval: '60',
  tempMin: '0',
  tempMax: '100',
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

async function openConfigDialog() {
  const deviceId = selectedDetail.value?.deviceId
  if (!deviceId) {
    return
  }
  configLoading.value = true
  try {
    const res: any = await controlApi.getConfig(deviceId)
    const config: DeviceConfig = res?.data?.data ?? res?.data
    configVersion.value = config?.version ?? 0
    configStatus.value = config?.status ?? ''
    applyConfigPayload(config?.payload)
  }
  catch {
    configVersion.value = 0
    configStatus.value = ''
    applyConfigPayload(null)
  }
  finally {
    configLoading.value = false
    showConfigDialog.value = true
  }
}

async function saveConfig() {
  const deviceId = selectedDetail.value?.deviceId
  if (!deviceId) {
    return
  }
  configSaving.value = true
  try {
    const res: any = await controlApi.setConfig(deviceId, buildConfigPayload())
    const data = res?.data?.data ?? res?.data
    if (data?.version != null) {
      configVersion.value = data.version
    }
    configStatus.value = data?.status ?? 'pending'
    showConfigDialog.value = false
    useFaToast().success('配置已保存并下发')
  }
  catch {
    useFaToast().error('配置保存失败')
  }
  finally {
    configSaving.value = false
  }
}

// ==================== 控制器 ====================
const controllerStore = useControllerStore()

const currentControllers = computed(() => {
  if (!selectedDetail.value) {
    return []
  }
  return controllerStore.getByDevice(selectedDetail.value.deviceId)
})

const showAddDialog = ref(false)
const controllerCmdLoading = ref(false)
const controllerForm = reactive({
  name: '',
  identifier: '',
  type: 'switch' as ControllerType,
  options: '',
})

function openAddDialog() {
  controllerForm.name = ''
  controllerForm.identifier = ''
  controllerForm.type = 'switch'
  controllerForm.options = ''
  showAddDialog.value = true
}

function addController() {
  const { name, identifier, type, options } = controllerForm
  if (!name.trim() || !identifier.trim()) {
    useFaToast().warning('请填写名称和标识名')
    return
  }
  if (!selectedDetail.value) {
    return
  }

  const id = `ctrl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const newCtrl: ControllerItem = {
    id,
    name: name.trim(),
    identifier: identifier.trim(),
    type,
    value: type === 'switch'
      ? false
      : (options ? options.split(',').map(s => s.trim())[0] || '' : ''),
    options: type === 'enum' && options
      ? options.split(',').map(s => s.trim()).filter(Boolean)
      : undefined,
  }

  const key = selectedDetail.value.deviceId
  controllerStore.add(key, newCtrl)
  showAddDialog.value = false
}

function removeController(ctrlId: string) {
  if (!selectedDetail.value) {
    return
  }
  controllerStore.remove(selectedDetail.value.deviceId, ctrlId)
}

async function toggleController(ctrl: ControllerItem) {
  if (!selectedDetail.value) {
    return
  }

  controllerCmdLoading.value = true
  const msg = {
    deviceId: selectedDetail.value.deviceId,
    type: 'control' as const,
    payload: {
      GPIO: ctrl.identifier,
      action: (ctrl.type === 'switch' ? (ctrl.value ? 'on' : 'off') : 'set') as 'toggle' | 'on' | 'off',
    },
  }

  if (!wsConnected.value) {
    useFaToast().warning('WebSocket 未连接，无法发送指令')
    controllerCmdLoading.value = false
    return
  }

  try {
    wsSend(msg)
  }
  catch {
    useFaToast().error('指令发送失败')
    // 发送失败时恢复原值
    if (ctrl.type === 'switch') {
      ctrl.value = !ctrl.value
    }
  }
  finally {
    controllerCmdLoading.value = false
  }
}

function getCtrlLabel(ctrl: ControllerItem): string {
  if (ctrl.type === 'switch') {
    return ctrl.value ? '开' : '关'
  }
  const map: Record<string, string> = { auto: '自动', cool: '制冷', heat: '制热', fan: '送风' }
  return map[ctrl.value as string] || String(ctrl.value)
}

// ==================== 手动下发设备 ====================
const dispatchLoading = ref(false)

async function dispatchDeviceConfig() {
  if (!selectedDetail.value) {
    return
  }
  const deviceId = selectedDetail.value.deviceId
  if (selectedDetail.value.status !== 'ONLINE') {
    useFaToast().warning('设备离线，无法下发')
    return
  }
  if (!wsConnected.value) {
    useFaToast().warning('WebSocket 未连接，无法下发')
    return
  }
  const controllers = currentControllers.value
  if (!controllers.length) {
    useFaToast().warning('暂无控制器，请先添加控制器')
    return
  }

  dispatchLoading.value = true
  try {
    controllers.forEach((ctrl) => {
      wsSend({
        deviceId,
        type: 'control',
        payload: {
          GPIO: ctrl.identifier,
          action: (ctrl.type === 'switch' ? (ctrl.value ? 'on' : 'off') : 'set') as 'toggle' | 'on' | 'off',
        },
      })
    })
    useFaToast().success('下发成功')
  }
  catch {
    useFaToast().error('下发失败')
  }
  finally {
    dispatchLoading.value = false
  }
}

// ==================== 加载设备列表 ====================
async function loadDeviceList() {
  listLoading.value = true
  try {
    const res = await deviceApi.list()
    // 兼容两种返回格式：真实后端 { data: [...] } 与 fake mock { data: { list, total } }
    // axios 拦截器已解包一层，payload 在 res.data
    const list = Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res?.data?.list)
        ? res.data.list
        : []
    deviceList.value = list.map((d: any) => ({
      deviceId: d.deviceId || d.deviceid || d.id || '',
      deviceName: d.deviceName || d.devicename || d.name || '',
      deviceType: d.deviceType || d.devicetype || '',
      status: (d.status || '').toUpperCase() === 'OFFLINE' ? 'OFFLINE' : 'ONLINE',
      lastActiveTime: d.lastActiveTime || d.updatedAt || d.updated_at || d.lastOnline || '',
    }))
  }
  catch (e) {
    useFaToast().error('加载设备列表失败')
    console.error('[DeviceControl] loadDeviceList error:', e)
  }
  finally {
    listLoading.value = false
  }
}

function formatTime(isoStr: string | undefined): string {
  if (!isoStr) {
    return '-'
  }
  try {
    return new Date(isoStr).toLocaleString()
  }
  catch {
    return isoStr
  }
}

// ==================== 监听 WSS 推送的设备状态 ====================
watch(wsLastResponse, (msg) => {
  if (!msg || !msg.deviceId) {
    return
  }

  // 更新列表中对应设备的状态
  const row = deviceList.value.find(d => d.deviceId === msg.deviceId)
  if (row) {
    if (msg.type === 'deviceOffline') {
      row.status = 'OFFLINE'
      row.lastActiveTime = msg.timestamp || new Date().toISOString()
    }
    else if (msg.type === 'deviceOnline') {
      row.status = 'ONLINE'
      row.lastActiveTime = msg.timestamp || new Date().toISOString()
    }
  }

  // 如果正在查看该设备详情，同步更新
  if (selectedDetail.value?.deviceId === msg.deviceId) {
    if (msg.type === 'deviceOffline') {
      selectedDetail.value.status = 'OFFLINE'
      selectedDetail.value.lastActiveTime = msg.timestamp || new Date().toISOString()
    }
    else if (msg.type === 'deviceOnline') {
      selectedDetail.value.status = 'ONLINE'
      selectedDetail.value.lastActiveTime = msg.timestamp || new Date().toISOString()
    }
  }
})

// ==================== 自动刷新（每 60 秒） ====================
const AUTO_REFRESH_INTERVAL = 60_000
const autoRefreshTimer = ref<number | null>(null)

function startAutoRefresh() {
  stopAutoRefresh()
  autoRefreshTimer.value = window.setInterval(() => {
    if (viewMode.value === 'detail' && selectedDetail.value) {
      refreshDetail(true)
    }
  }, AUTO_REFRESH_INTERVAL)
}

function stopAutoRefresh() {
  if (autoRefreshTimer.value !== null) {
    clearInterval(autoRefreshTimer.value)
    autoRefreshTimer.value = null
  }
}

// ==================== 路由参数直接进入详情 ====================
watch(() => route.query.deviceId, (val) => {
  const deviceId = typeof val === 'string' ? val : ''
  if (deviceId && deviceId !== selectedDetail.value?.deviceId) {
    enterDetail(deviceId)
  }
}, { immediate: true })

onMounted(() => {
  loadDeviceList()
  wsConnect('')
  startAutoRefresh()
})

onActivated(() => {
  startAutoRefresh()
})

onDeactivated(() => {
  stopAutoRefresh()
})

onBeforeUnmount(() => {
  stopAutoRefresh()
  wsDisconnect()
})
</script>

<template>
  <FaPageMain
    class="!m-0 border-0! rounded-none! h-full! overflow-hidden!"
    main-class="flex flex-col overflow-hidden! p-4"
  >
    <!-- ==================== 列表视图 ==================== -->
    <template v-if="viewMode === 'list'">
      <div class="flex shrink-0 items-center justify-between">
        <span class="font-semibold">设备管理</span>
        <div class="text-sm flex gap-3 items-center">
          <FaTag :variant="wsConnected ? 'default' : 'secondary'">
            {{ wsConnected ? 'WSS 已连接' : 'HTTP' }}
          </FaTag>
          <FaButton variant="outline" size="sm" :loading="listLoading" @click="loadDeviceList">
            刷新
          </FaButton>
        </div>
      </div>
      <div class="p-4 flex-1 min-h-0">
        <FaTable
          :columns="deviceColumns" :data="deviceList" table-root-class="rounded-lg overflow-hidden" stripe
          border
        >
          <template #cell-status="{ value }">
            <FaTag :variant="value === 'ONLINE' ? 'default' : 'secondary'">
              {{ value === 'ONLINE' ? '在线' : '离线' }}
            </FaTag>
          </template>
          <template #cell-lastActiveTime="{ value }">
            {{ formatTime(value) }}
          </template>
          <template #cell-deviceId="{ value }">
            <span class="text-primary cursor-pointer hover:underline" @click="enterDetail(value)">{{ value }}</span>
          </template>
        </FaTable>
      </div>
    </template>

    <!-- ==================== 详情视图 ==================== -->
    <template v-else>
      <div class="flex shrink-0 gap-3 items-center justify-between">
        <div class="flex gap-3 items-center">
          <FaButton variant="ghost" size="sm" @click="backToList">
            ← 返回列表
          </FaButton>
          <span class="font-semibold">{{ selectedDetail?.deviceName }}（{{ selectedDetail?.deviceId }}）</span>
          <FaTag :variant="selectedDetail?.status === 'ONLINE' ? 'default' : 'destructive'">
            {{ selectedDetail?.status === 'ONLINE' ? '在线' : '离线' }}
          </FaTag>
        </div>
        <div class="flex gap-2 items-center">
          <FaTag :variant="wsConnected ? 'default' : 'secondary'">
            {{ wsConnected ? 'WSS 已连接' : 'HTTP' }}
          </FaTag>
          <FaButton variant="outline" size="sm" :loading="configLoading" @click="openConfigDialog">
            <FaIcon name="i-material-symbols:settings-outline" class="mr-1 size-4" />
            配置
          </FaButton>
          <FaButton variant="outline" size="sm" :loading="dispatchLoading" @click="dispatchDeviceConfig">
            下发设备
          </FaButton>
        </div>
      </div>

      <div class="flex flex-1 flex-col gap-3 min-h-0">
        <!-- 设备信息 -->
        <FaCard title="设备信息" class="shrink-0">
          <div v-if="selectedDetail" class="text-sm gap-3 grid grid-cols-2 md:grid-cols-4">
            <div><span class="text-gray-500">设备ID：</span>{{ selectedDetail.deviceId }}</div>
            <div><span class="text-gray-500">设备类型：</span>{{ selectedDetail.deviceType }}</div>
            <div><span class="text-gray-500">状态：</span>{{ selectedDetail.status === 'ONLINE' ? '在线' : '离线' }}</div>
            <div><span class="text-gray-500">最后活跃：</span>{{ formatTime(selectedDetail.lastActiveTime) }}</div>
            <div v-if="selectedDetail.ipAddress">
              <span class="text-gray-500">IP：</span>{{ selectedDetail.ipAddress }}
            </div>
            <div v-if="selectedDetail.macAddress">
              <span class="text-gray-500">MAC：</span>{{ selectedDetail.macAddress }}
            </div>
            <div v-if="selectedDetail.firmwareVersion">
              <span class="text-gray-500">固件：</span>{{ selectedDetail.firmwareVersion }}
            </div>
            <div v-if="selectedDetail.location">
              <span class="text-gray-500">位置：</span>{{ selectedDetail.location }}
            </div>
            <div class="text-xs text-gray-400 col-span-2 md:col-span-4">
              创建于 {{ formatTime(selectedDetail.createdAt) }} · 更新于 {{ formatTime(selectedDetail.updatedAt) }}
            </div>
          </div>
        </FaCard>

        <!-- 传感器 + 控制器 -->
        <div class="flex flex-1 gap-3 min-h-0">
          <FaCard title="传感器" class="flex-1 min-w-0" content-class="flex-1 min-h-0 overflow-auto">
            <template #header>
              <div class="flex gap-2 w-full items-center justify-between">
                <span>传感器</span>
                <div class="flex gap-2 items-center">
                  <span v-if="lastRefreshTime" class="text-xs text-gray-400">
                    更新于 {{ lastRefreshTime }} · 每 60 秒自动刷新
                  </span>
                  <FaButton variant="outline" size="sm" @click="openAddSensorDialog">
                    <FaIcon name="i-material-symbols:add" class="mr-1 size-4" />
                    添加
                  </FaButton>
                  <FaButton variant="outline" size="sm" :loading="detailLoading" @click="refreshDetail()">
                    刷新
                  </FaButton>
                </div>
              </div>
            </template>
            <div v-if="displaySensors.length" class="gap-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              <FaCard
                v-for="sensor in displaySensors" :key="sensor.identifier"
                class="!p-0! !gap-0! overflow-hidden" content-class="!p-0!"
              >
                <div class="px-4 py-3">
                  <div class="flex gap-2 items-center justify-between">
                    <span class="text-primary font-semibold min-w-0 truncate">{{ sensor.name }}</span>
                    <span class="text-xs text-gray-400 shrink-0">{{ sensor.transferType }}</span>
                  </div>
                  <div class="mt-3 flex gap-1 items-baseline">
                    <span class="text-2xl text-primary leading-none font-bold">{{ sensor.value || '-' }}</span>
                    <span v-if="sensor.unit" class="text-sm text-gray-400">{{ sensor.unit }}</span>
                  </div>
                  <div class="text-xs text-gray-400 mt-2">
                    {{ sensor.dataType || '未知类型' }} · 标识 {{ sensor.identifier }}
                  </div>
                </div>
              </FaCard>
            </div>
            <FaEmpty v-else description="无传感器数据" />
          </FaCard>

          <FaCard title="控制器" class="p-3 flex-1 min-w-0" content-class="flex-1 min-h-0 overflow-auto">
            <template #header>
              <div class="flex w-full items-center justify-between">
                <span>控制器</span>
                <FaButton variant="outline" size="sm" @click="openAddDialog">
                  <FaIcon name="i-material-symbols:add" class="mr-1 size-4" />
                  添加
                </FaButton>
              </div>
            </template>
            <FaEmpty v-if="currentControllers.length === 0" description="暂无控制器，点击添加" />
            <div v-else class="flex flex-col gap-3">
              <div v-for="ctrl in currentControllers" :key="ctrl.id" class="p-3 border rounded-lg flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium truncate">{{ ctrl.name }}</span>
                  <FaButton
                    variant="ghost" size="icon" class="text-gray-400 size-6 hover:text-red-500"
                    @click="removeController(ctrl.id)"
                  >
                    <FaIcon name="i-material-symbols:close" class="size-3.5" />
                  </FaButton>
                </div>
                <div class="text-xs text-gray-400">
                  GPIO {{ ctrl.identifier }}
                </div>

                <template v-if="ctrl.type === 'switch'">
                  <FaSwitch
                    :model-value="(ctrl.value as boolean)" :loading="controllerCmdLoading"
                    @update:model-value="ctrl.value = ($event as boolean); toggleController(ctrl)"
                  />
                </template>

                <template v-else>
                  <div class="flex flex-wrap gap-1">
                    <FaButton
                      v-for="opt in ctrl.options" :key="opt"
                      :variant="ctrl.value === opt ? 'default' : 'outline'" size="sm" :loading="controllerCmdLoading"
                      @click="ctrl.value = opt; toggleController(ctrl)"
                    >
                      {{ getCtrlLabel({ ...ctrl, value: opt }) }}
                    </FaButton>
                  </div>
                </template>
              </div>
            </div>
          </FaCard>
        </div>
      </div>
    </template>

    <!-- 设备配置弹窗 -->
    <FaModal
      v-model="showConfigDialog" title="设备配置" show-cancel-button
      :confirm-button-loading="configSaving" @confirm="saveConfig" @cancel="showConfigDialog = false"
    >
      <div v-if="configVersion > 0" class="text-xs text-gray-400 mb-2">
        当前版本 v{{ configVersion }} · 状态：{{ configStatus || '未确认' }}
      </div>
      <div class="py-2 pr-1 flex flex-col gap-4 max-h-70vh overflow-auto">
        <div class="flex flex-col gap-2">
          <div class="text-sm text-muted-foreground font-semibold">
            网络 (network)
          </div>
          <div class="gap-3 grid grid-cols-1 sm:grid-cols-2">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">WiFi SSID</label>
              <FaInput v-model="configForm.wifiSsid" placeholder="如：MyWiFi" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">WiFi 密码</label>
              <FaInput v-model="configForm.wifiPassword" placeholder="WiFi 密码" type="password" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">MQTT Host</label>
              <FaInput v-model="configForm.mqttHost" placeholder="如：broker.example.com" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">MQTT Port</label>
              <FaInput v-model="configForm.mqttPort" placeholder="1883" />
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
          <div class="gap-3 grid grid-cols-1 sm:grid-cols-3">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">上报间隔 (s)</label>
              <FaInput v-model="configForm.reportInterval" placeholder="60" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">温度下限 (°C)</label>
              <FaInput v-model="configForm.tempMin" placeholder="0" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">温度上限 (°C)</label>
              <FaInput v-model="configForm.tempMax" placeholder="100" />
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="text-sm text-muted-foreground font-semibold">
            执行器 (actuator)
          </div>
          <div class="flex flex-col gap-1 w-full sm:w-1/2">
            <label class="text-sm font-medium">模式</label>
            <FaSelect v-model="configForm.actuatorMode" :options="actuatorModeOptions" />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="text-sm text-muted-foreground font-semibold">
            摄像头 (camera)
          </div>
          <div class="gap-3 grid grid-cols-1 sm:grid-cols-2">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">SMTP Host</label>
              <FaInput v-model="configForm.smtpHost" placeholder="如：smtp.example.com" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">SMTP Port</label>
              <FaInput v-model="configForm.smtpPort" placeholder="465" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">SMTP 用户名</label>
              <FaInput v-model="configForm.smtpUsername" placeholder="邮箱账号" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">SMTP 密码</label>
              <FaInput v-model="configForm.smtpPassword" type="password" placeholder="授权码" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">抓拍间隔 (s)</label>
              <FaInput v-model="configForm.snapshotInterval" placeholder="30" />
            </div>
          </div>
          <FaCheckbox v-model="configForm.smtpSsl">
            SMTP SSL
          </FaCheckbox>
        </div>
      </div>
    </FaModal>

    <!-- 添加传感器弹窗 -->
    <FaModal
      v-model="showAddSensorDialog" title="添加传感器" show-cancel-button @confirm="addSensor"
      @cancel="showAddSensorDialog = false"
    >
      <div class="py-2 flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">名称</label>
          <FaInput v-model="sensorForm.name" placeholder="如：温度、湿度" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">标识名 (identifier)</label>
          <FaInput v-model="sensorForm.identifier" placeholder="如：temperature" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">传输类型</label>
          <FaSelect v-model="sensorForm.transferType" :options="transferTypeOptions" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">数据类型</label>
          <FaSelect v-model="sensorForm.dataType" :options="sensorTypeOptions" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">单位（可选）</label>
          <FaInput v-model="sensorForm.unit" placeholder="如：°C、%RH" />
        </div>
      </div>
    </FaModal>

    <!-- 添加控制器弹窗 -->
    <FaModal
      v-model="showAddDialog" title="添加控制器" show-cancel-button @confirm="addController"
      @cancel="showAddDialog = false"
    >
      <div class="py-2 flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">名称</label>
          <FaInput v-model="controllerForm.name" placeholder="如：电源开关、运行模式" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">标识名 (GPIO)</label>
          <FaInput v-model="controllerForm.identifier" placeholder="如：1、2、3" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">类型</label>
          <FaSelect
            v-model="controllerForm.type" :options="[
              { label: '开关', value: 'switch' },
              { label: '枚举', value: 'enum' },
            ]"
          />
        </div>
        <div v-if="controllerForm.type === 'enum'" class="flex flex-col gap-1">
          <label class="text-sm font-medium">选项（逗号分隔）</label>
          <FaInput v-model="controllerForm.options" placeholder="如：auto,cool,heat,fan" />
        </div>
      </div>
    </FaModal>
  </FaPageMain>
</template>
