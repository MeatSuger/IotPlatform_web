<script setup lang="ts">
import type { DescriptionItem, TableColumn } from '@fantastic-admin/components'
import type { Actuator } from '@/api/modules/iot/actuator'
import type { DeviceDetail } from '@/api/modules/iot/control'
import type { Sensor } from '@/api/modules/iot/sensor'
import { actuatorApi } from '@/api/modules/iot/actuator'
import { controlApi } from '@/api/modules/iot/control'
import { deviceApi } from '@/api/modules/iot/device'
import { sensorApi } from '@/api/modules/iot/sensor'
import { useDeviceWebSocket } from '@/composables/useDeviceWebSocket'
import ActuatorEditDialog from './components/ActuatorEditDialog.vue'
import DeviceEditDialog from './components/DeviceEditDialog.vue'
import SensorEditDialog from './components/SensorEditDialog.vue'

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
    // 详情接口已含完整物模型（sensors=定义+latest、actuators=定义），无需额外拉取
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

// 编辑设备弹窗（基础资料 + 高级配置折叠）
const showDeviceEditDialog = ref(false)

function openDeviceEditDialog() {
  showDeviceEditDialog.value = true
}

function onDeviceSaved() {
  refreshDetail(true)
}

function openDeviceLog() {
  if (selectedDetail.value) {
    router.push({ name: 'LogDevice', query: { deviceId: selectedDetail.value.deviceId } })
  }
}

// 设备信息展示项（FaDescriptions，条件字段按存在性展开）
const deviceDescriptionItems = computed<DescriptionItem[]>(() => {
  const d = selectedDetail.value
  if (!d) {
    return []
  }
  const items: DescriptionItem[] = [
    { key: 'deviceId', label: '设备ID', value: d.deviceId },
    { key: 'deviceType', label: '设备类型', value: d.deviceType },
    { key: 'status', label: '状态', value: d.status === 'ONLINE' ? '在线' : '离线' },
    { key: 'lastActive', label: '最后活跃', value: formatTime(d.lastActiveTime) },
  ]
  if (d.ipAddress) {
    items.push({ key: 'ip', label: 'IP', value: d.ipAddress })
  }
  if (d.macAddress) {
    items.push({ key: 'mac', label: 'MAC', value: d.macAddress })
  }
  if (d.firmwareVersion) {
    items.push({ key: 'firmware', label: '固件', value: d.firmwareVersion })
  }
  if (d.location) {
    items.push({ key: 'location', label: '位置', value: d.location })
  }
  return items
})

// ==================== 传感器物模型 + 数值展示（详情接口即数据源：sensors = 定义 + latest） ====================
export interface DisplaySensor extends Sensor {
  // 最近一次上报值（详情 latest.value；null = 从未上报）
  value: number | string | boolean | null
  latestTimestamp?: string
}

const sensorViewMode = ref<'list' | 'grid'>('list')

const displaySensors = computed<DisplaySensor[]>(() =>
  (selectedDetail.value?.sensors ?? []).map((s: any) => ({
    ...s,
    value: s.latest?.value ?? null,
    latestTimestamp: s.latest?.timestamp,
  })),
)

const sensorColumns: TableColumn<DisplaySensor>[] = [
  { accessorKey: 'name', header: '传感器名称', width: 160 },
  { accessorKey: 'id', header: '标识' },
  { accessorKey: 'type', header: '类别', width: 110, align: 'center' },
  { accessorKey: 'dataType', header: '数据类型', width: 110, align: 'center' },
  { accessorKey: 'value', header: '当前值', width: 130 },
  { accessorKey: 'enabled', header: '启用', width: 80, align: 'center' },
  {
    id: 'sensorMore',
    header: '操作',
    width: 60,
    align: 'center',
  },
]

function switchSensorToList() {
  sensorViewMode.value = 'list'
}

function switchSensorToGrid() {
  sensorViewMode.value = 'grid'
}

// ==================== 新增 / 编辑 / 删除 传感器定义（弹窗 SensorEditDialog） ====================
const showSensorDialog = ref(false)
const sensorDialogMode = ref<'add' | 'edit'>('add')
const editingSensor = ref<DisplaySensor | null>(null)

function openAddSensorDialog() {
  sensorDialogMode.value = 'add'
  editingSensor.value = null
  showSensorDialog.value = true
}

function openEditSensorDialog(sensor: DisplaySensor) {
  sensorDialogMode.value = 'edit'
  editingSensor.value = sensor
  showSensorDialog.value = true
}

// 「显示」→ 跳转数据监控页并聚焦该传感器（keyword = 传感器 id，监控页按 id/类型过滤 + 轮询）
function goSensorMonitor(sensor: DisplaySensor) {
  const deviceId = selectedDetail.value?.deviceId
  if (!deviceId) {
    return
  }
  router.push({
    name: 'MonitorIndex',
    query: { deviceId, keyword: sensor.id },
  })
}

function onSensorSaved() {
  refreshDetail(true)
}

function removeSensor(sensor: DisplaySensor) {
  const deviceId = selectedDetail.value?.deviceId
  if (!deviceId) {
    return
  }
  useFaModal().confirm({
    title: '确认信息',
    content: `确认删除传感器「${sensor.name || sensor.id}」吗？`,
    onConfirm: async () => {
      try {
        await sensorApi.remove(deviceId, sensor.id)
        useFaToast().success('传感器删除成功')
        await refreshDetail(true)
      }
      catch {
        useFaToast().error('传感器删除失败')
      }
    },
  })
}

// ==================== 执行器定义（物模型，后端 API.md 4.7）+ 运行控制 ====================
// 执行器物模型直接来自详情接口（data.actuators = 定义数组），CRUD/下发后刷新详情即可
const actuators = computed<Actuator[]>(() => selectedDetail.value?.actuators ?? [])

// ==================== 新增 / 编辑 / 删除 执行器定义（弹窗 ActuatorEditDialog） ====================
const showActuatorDialog = ref(false)
const actuatorDialogMode = ref<'add' | 'edit'>('add')
const editingActuator = ref<Actuator | null>(null)

function openAddActuatorDialog() {
  actuatorDialogMode.value = 'add'
  editingActuator.value = null
  showActuatorDialog.value = true
}

function openEditActuatorDialog(act: Actuator) {
  actuatorDialogMode.value = 'edit'
  editingActuator.value = act
  showActuatorDialog.value = true
}

function onActuatorSaved() {
  refreshDetail(true)
}

function removeActuator(act: Actuator) {
  const deviceId = selectedDetail.value?.deviceId
  if (!deviceId) {
    return
  }
  useFaModal().confirm({
    title: '确认信息',
    content: `确认删除执行器「${act.name || act.id}」吗？删除后需下发设备才会卸载。`,
    onConfirm: async () => {
      try {
        await actuatorApi.remove(deviceId, act.id)
        useFaToast().success('执行器删除成功')
        await refreshDetail(true)
      }
      catch {
        useFaToast().error('执行器删除失败')
      }
    },
  })
}

// —— 运行控制 ——
// 控件以自然交互呈现（开关/滑块/输入框/颜色），发送时由云端转换为设备传输原语：
//   gpio → {level}；pwm → {duty} 或 {pulse_us}；spi → {tx}；led_strip → {rgb}
// （固件不做器件语义换算，见 docs/mqtt-api.md）
const LED_COLOR_PRESETS = ['#ff4d4f', '#52c41a', '#1677ff', '#ffffff']
const PWM_PRESETS = [0, 25, 50, 75, 100]

// 每个执行器的运行期控件状态（会话内保留，按 deviceId 隔离）
const actuatorStates = reactive<Record<string, Record<string, Record<string, any>>>>({})

function runtimeState(act: Actuator): Record<string, any> {
  const deviceId = selectedDetail.value?.deviceId ?? ''
  const byDevice = actuatorStates[deviceId] ?? (actuatorStates[deviceId] = {})
  return byDevice[act.id] ?? (byDevice[act.id] = {
    on: false,
    duty: 0,
    pulseUs: '1500',
    colorHex: LED_COLOR_PRESETS[0],
    txText: '',
    txArray: '',
  })
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  const full = normalized.length === 3 ? normalized.split('').map(c => `${c}${c}`).join('') : normalized
  const num = parseInt(full, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

// led_strip 传输原语：固件契约 value = {rgb:[r,g,b]}（见 docs/mqtt-api.md），
// 云端将颜色语义换算为 rgb 数组后下发，固件不做器件语义换算。
function hexToRgbPrimitive(hex: string): Record<string, any> {
  const { r, g, b } = hexToRgb(hex)
  return { rgb: [r, g, b] }
}

const actuatorCmdBusy = ref('')

async function sendActuatorControl(act: Actuator, value: Record<string, any>) {
  const deviceId = selectedDetail.value?.deviceId
  if (!deviceId) {
    return
  }
  actuatorCmdBusy.value = act.id
  try {
    if (wsConnected.value) {
      wsSend({ deviceId, type: 'control', payload: { action: act.id, value } })
    }
    else {
      // WS 未连接时走 HTTP 命令队列（离线设备下次轮询 /commands 拉到）
      await controlApi.sendCommand(deviceId, { type: 'control', payload: { action: act.id, value } })
    }
  }
  catch {
    useFaToast().error('指令发送失败')
  }
  finally {
    actuatorCmdBusy.value = ''
  }
}

// gpio：开关 → 逻辑电平（FaSwitch 事件值可 undefined）
function onGpioToggle(act: Actuator, on?: boolean) {
  const enabled = on === true
  runtimeState(act).on = enabled
  sendActuatorControl(act, { level: enabled ? 1 : 0 })
}

// pwm：占空比滑块 / 预设
function onPwmDuty(act: Actuator, duty: number) {
  const st = runtimeState(act)
  st.duty = duty
  sendActuatorControl(act, { duty })
}

// pwm：脉宽输入（舵机类等；云端直接下发原语）
function onPwmPulseUs(act: Actuator, text: string) {
  const st = runtimeState(act)
  const value = Number(String(text ?? '').trim())
  if (Number.isNaN(value) || value < 0) {
    useFaToast().warning('脉宽需为非负整数 (µs)')
    return
  }
  st.pulseUs = String(value)
  sendActuatorControl(act, { pulse_us: value })
}

// spi：tx 文本（hex 串或数组文本，原样下发）
function onSpiTx(act: Actuator, text: string) {
  const st = runtimeState(act)
  const trimmed = String(text ?? '').trim()
  if (!trimmed) {
    useFaToast().warning('请输入要发送的数据（如 A5 3C FF 或 [165,60,255]）')
    return
  }
  st.txText = trimmed
  st.txArray = trimmed
  sendActuatorControl(act, { tx: trimmed })
}

// led_strip：开关 → 全灭 / 上次颜色（FaSwitch 事件值可 undefined）
function onLedStripToggle(act: Actuator, on?: boolean) {
  const enabled = on === true
  runtimeState(act).on = enabled
  sendActuatorControl(act, enabled ? hexToRgbPrimitive(runtimeState(act).colorHex) : { rgb: [0, 0, 0] })
}

// led_strip：颜色（hex → rgb 传输原语）
function onLedStripColor(act: Actuator, color: string) {
  const st = runtimeState(act)
  st.colorHex = color
  st.on = true
  sendActuatorControl(act, hexToRgbPrimitive(color))
}

// 执行器真实类型 = config.transport（driver 仅为后端兼容标识）
function transportOf(act: Actuator): string {
  const t = act.config?.transport
  return typeof t === 'string' ? t : ''
}

function actuatorConfigSummary(act: Actuator): string {
  const cfg = act.config ?? {}
  const transport = transportOf(act)
  if (transport === 'pwm') {
    return `pin ${cfg.pin ?? '-'} · ${cfg.freq_hz ?? 1000}Hz`
  }
  if (transport === 'spi') {
    return `cs ${cfg.cs ?? '-'} · ${cfg.freq_hz ?? 1000000}Hz · mode ${cfg.mode ?? 0}`
  }
  if (transport === 'led_strip') {
    return `GPIO ${cfg.gpio ?? 48}${cfg.count ? ` · ${cfg.count} 颗` : ''}`
  }
  if (transport === 'gpio') {
    return `pin ${cfg.pin ?? '-'}${cfg.active_high === false ? ' · 低有效' : ''}`
  }
  return '旧版定义（无 transport），编辑保存后升级'
}

// ==================== 手动下发设备（传感器 + 执行器定义编译下发） ====================
const dispatchLoading = ref(false)

async function dispatchDeviceConfig() {
  const deviceId = selectedDetail.value?.deviceId
  if (!deviceId) {
    return
  }

  dispatchLoading.value = true
  const parts: string[] = []

  // 1. 传感器定义 → /sensors/apply（编译全部定义进 payload.sensors，保留其余分区；HTTP，离线入队待设备拉取）
  try {
    const sensorRes: any = await sensorApi.apply(deviceId)
    const sensorData = sensorRes?.data?.data ?? sensorRes?.data
    parts.push(`传感器 ${sensorData?.count ?? 0} 项（v${sensorData?.version ?? '-'}）`)
  }
  catch (e) {
    console.error('[DeviceControl] sensor apply failed:', e)
    useFaToast().error('传感器配置下发失败')
  }

  // 2. 执行器定义 → /actuators/apply（编译全部定义进 payload.actuators，保留其余分区；HTTP，离线入队待设备拉取）
  try {
    const actRes: any = await actuatorApi.apply(deviceId)
    const actData = actRes?.data?.data ?? actRes?.data
    parts.push(`执行器 ${actData?.count ?? 0} 项（v${actData?.version ?? '-'}）`)
  }
  catch (e) {
    console.error('[DeviceControl] actuator apply failed:', e)
    useFaToast().error('执行器配置下发失败')
  }

  if (parts.length) {
    useFaToast().success(`已下发：${parts.join(' + ')}`)
  }
  else {
    useFaToast().error('下发失败')
  }
  dispatchLoading.value = false
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

    // 遥测推送：平台转发设备上行 { deviceId, data: { type:'data', sensors:[{name,type,value,timestamp}] } }
    // 按 name(= 定义 id) 更新对应传感器 latest，实时刷新当前值
    const push = (msg as any).data
    if (push && push.type === 'data' && Array.isArray(push.sensors) && selectedDetail.value?.sensors) {
      const byName = new Map<string, any>(push.sensors.map((s: any) => [s.name, s]))
      ;(selectedDetail.value.sensors as any[]).forEach((s: any) => {
        const hit = byName.get(s.id)
        if (hit && hit.value !== undefined) {
          s.latest = { value: hit.value, timestamp: hit.timestamp }
        }
      })
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
          <FaButton variant="outline" size="sm" @click="openDeviceEditDialog">
            <FaIcon name="i-ri:edit-line" class="mr-1 size-4" />
            编辑
          </FaButton>
          <FaButton variant="outline" size="sm" @click="openDeviceLog">
            <FaIcon name="i-ri:file-list-3-line" class="mr-1 size-4" />
            日志
          </FaButton>
          <FaButton variant="outline" size="sm" :loading="dispatchLoading" @click="dispatchDeviceConfig">
            下发设备
          </FaButton>
        </div>
      </div>

      <div class="flex flex-1 flex-col gap-3 min-h-0">
        <!-- 设备信息 -->
        <FaCard title="设备信息" class="shrink-0">
          <div v-if="selectedDetail" class="flex flex-col gap-2">
            <FaDescriptions :items="deviceDescriptionItems" :column="4" />
            <div class="text-xs text-gray-400">
              创建于 {{ formatTime(selectedDetail.createdAt) }} · 更新于 {{ formatTime(selectedDetail.updatedAt) }}
            </div>
          </div>
        </FaCard>

        <!-- 传感器 + 执行器 -->
        <div class="flex flex-1 gap-3 min-h-0">
          <FaCard title="传感器" class="flex-1 min-w-0" content-class="flex-1 min-h-0 overflow-auto">
            <template #header>
              <div class="flex gap-2 w-full items-center justify-between">
                <span>传感器</span>
                <div class="flex gap-2 items-center">
                  <span v-if="lastRefreshTime" class="text-xs text-gray-400">
                    更新于 {{ lastRefreshTime }} · 每 60 秒自动刷新
                  </span>
                  <FaButtonGroup>
                    <FaButton :variant="sensorViewMode === 'list' ? 'default' : 'outline'" size="sm" @click="switchSensorToList">
                      <FaIcon name="i-ri:list-unordered" />
                    </FaButton>
                    <FaButton :variant="sensorViewMode === 'grid' ? 'default' : 'outline'" size="sm" @click="switchSensorToGrid">
                      <FaIcon name="i-ri:layout-grid-line" />
                    </FaButton>
                  </FaButtonGroup>
                  <FaButton variant="outline" size="sm" @click="openAddSensorDialog">
                    <FaIcon name="i-ri:add-line" class="mr-1 size-4" />
                    添加
                  </FaButton>
                  <FaButton variant="outline" size="sm" :loading="detailLoading" @click="refreshDetail()">
                    刷新
                  </FaButton>
                </div>
              </div>
            </template>

            <!-- 列表视图（对齐设备信息表格） -->
            <template v-if="sensorViewMode === 'list'">
              <FaTable
                v-if="displaySensors.length"
                table-root-class="rounded-lg overflow-hidden"
                row-key="id"
                stripe
                border
                :columns="sensorColumns"
                :data="displaySensors"
              >
                <template #cell-name="{ row }">
                  <FaTooltip :delay="100" side="bottom" align="start">
                    <span class="text-primary font-semibold underline decoration-1 underline-offset-2 cursor-pointer whitespace-nowrap hover:text-primary/80" @click="openEditSensorDialog(row.original)">
                      {{ row.original.name }}
                    </span>
                    <template #content>
                      <span class="cursor-pointer whitespace-nowrap hover:opacity-70" @click.stop="openEditSensorDialog(row.original)">编辑</span>
                    </template>
                  </FaTooltip>
                </template>
                <template #cell-type="{ value }">
                  <FaTag variant="secondary">
                    {{ value || '-' }}
                  </FaTag>
                </template>
                <template #cell-dataType="{ value }">
                  <FaTag variant="secondary">
                    {{ value || '-' }}
                  </FaTag>
                </template>
                <template #cell-value="{ row }">
                  <span class="font-semibold">{{ row.original.value ?? '-' }}{{ row.original.unit ?? '' }}</span>
                </template>
                <template #cell-enabled="{ value }">
                  <FaTag :variant="value === false ? 'secondary' : 'default'">
                    {{ value === false ? '停用' : '启用' }}
                  </FaTag>
                </template>
                <template #cell-sensorMore="{ row }">
                  <FaDropdown
                    :items="[
                      [
                        { label: '显示', handle: () => goSensorMonitor(row.original) },
                        { label: '编辑', handle: () => openEditSensorDialog(row.original) },
                        { label: '删除', variant: 'destructive', handle: () => removeSensor(row.original) },
                      ],
                    ]"
                  >
                    <FaButton variant="outline" size="icon-sm">
                      <FaIcon name="i-ri:more-2-fill" />
                    </FaButton>
                  </FaDropdown>
                </template>
              </FaTable>
              <el-empty v-else description="无传感器数据" />
            </template>

            <!-- 网格视图（对齐设备信息卡片） -->
            <template v-else>
              <div v-if="displaySensors.length" class="gap-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                <FaCard
                  v-for="sensor in displaySensors" :key="sensor.id"
                  class="!p-0! !gap-0! overflow-hidden" content-class="!p-0!"
                >
                  <div class="px-4 py-2.5 border-b flex gap-2 items-center">
                    <span class="text-primary font-semibold underline decoration-1 underline-offset-2 min-w-0 cursor-pointer truncate hover:text-primary/80" @click="openEditSensorDialog(sensor)">
                      {{ sensor.name }}
                    </span>
                    <div class="ml-auto flex shrink-0 gap-1.5 items-center">
                      <FaTag :variant="sensor.enabled === false ? 'secondary' : 'default'">
                        {{ sensor.enabled === false ? '停用' : '启用' }}
                      </FaTag>
                      <FaTag variant="secondary">
                        {{ sensor.type || '-' }}
                      </FaTag>
                      <FaDropdown
                        :items="[
                          [
                            { label: '显示', handle: () => goSensorMonitor(sensor) },
                            { label: '编辑', handle: () => openEditSensorDialog(sensor) },
                            { label: '删除', variant: 'destructive', handle: () => removeSensor(sensor) },
                          ],
                        ]"
                      >
                        <FaButton variant="ghost" size="icon-sm">
                          <FaIcon name="i-ri:more-2-fill" />
                        </FaButton>
                      </FaDropdown>
                    </div>
                  </div>
                  <div class="text-sm px-4 py-3 flex flex-col gap-2">
                    <div class="flex gap-3 items-center justify-between">
                      <span class="text-gray-500 shrink-0">标识</span>
                      <span class="font-medium min-w-0 truncate">{{ sensor.id }}</span>
                    </div>
                    <div class="flex gap-3 items-center justify-between">
                      <span class="text-gray-500 shrink-0">数据类型</span>
                      <span class="font-medium min-w-0 truncate">{{ sensor.dataType || '-' }}</span>
                    </div>
                    <div v-if="sensor.reportInterval != null" class="flex gap-3 items-center justify-between">
                      <span class="text-gray-500 shrink-0">上报间隔</span>
                      <span class="font-medium min-w-0 truncate">{{ sensor.reportInterval }}s</span>
                    </div>
                    <div class="flex gap-3 items-center justify-between">
                      <span class="text-gray-500 shrink-0">当前值</span>
                      <span class="text-primary font-semibold min-w-0 truncate">{{ sensor.value ?? '-' }}{{ sensor.unit ?? '' }}</span>
                    </div>
                  </div>
                  <div class="px-4 py-2.5 border-t bg-accent/50">
                    <FaButton variant="outline" size="sm" class="w-full" @click="openEditSensorDialog(sensor)">
                      <FaIcon name="i-ri:edit-line" />
                      编辑
                    </FaButton>
                  </div>
                </FaCard>
              </div>
              <el-empty v-else description="无传感器数据" />
            </template>
          </FaCard>

          <FaCard title="执行器" class="p-3 flex-1 min-w-0" content-class="flex-1 min-h-0 overflow-auto">
            <template #header>
              <div class="flex w-full items-center justify-between">
                <span>执行器</span>
                <FaButton variant="outline" size="sm" @click="openAddActuatorDialog">
                  <FaIcon name="i-ri:add-line" class="mr-1 size-4" />
                  添加
                </FaButton>
              </div>
            </template>
            <div v-if="actuators.length === 0" class="text-gray-400 py-8 flex flex-col gap-1 items-center">
              <span>暂无执行器定义，点击「添加」创建</span>
              <span class="text-xs">创建后点击「下发设备」编译下发，设备侧按 config.transport 实例化</span>
            </div>
            <div v-else class="flex flex-col gap-3">
              <div v-for="act in actuators" :key="act.id" class="p-3 border rounded-lg flex flex-col gap-2">
                <div class="flex gap-2 items-center justify-between">
                  <div class="flex gap-2 min-w-0 items-center">
                    <span class="text-sm font-medium truncate">{{ act.name || act.id }}</span>
                    <FaTag variant="secondary">
                      {{ transportOf(act) || act.driver }}
                    </FaTag>
                    <FaTag :variant="act.enabled === false ? 'secondary' : 'default'">
                      {{ act.enabled === false ? '停用' : '启用' }}
                    </FaTag>
                  </div>
                  <FaDropdown
                    :items="[
                      [
                        { label: '编辑', handle: () => openEditActuatorDialog(act) },
                        { label: '删除', variant: 'destructive', handle: () => removeActuator(act) },
                      ],
                    ]"
                  >
                    <FaButton variant="outline" size="icon-sm">
                      <FaIcon name="i-ri:more-2-fill" />
                    </FaButton>
                  </FaDropdown>
                </div>
                <div class="text-xs text-gray-400">
                  {{ act.id }} · {{ actuatorConfigSummary(act) }}
                </div>

                <template v-if="act.enabled !== false">
                  <!-- gpio：开关（高/低电平） -->
                  <template v-if="transportOf(act) === 'gpio'">
                    <FaSwitch
                      :model-value="runtimeState(act).on" :disabled="actuatorCmdBusy === act.id"
                      @update:model-value="(val?: boolean) => onGpioToggle(act, val)"
                    />
                  </template>

                  <!-- pwm：占空比滑块 + 预设 + 脉宽输入 -->
                  <template v-else-if="transportOf(act) === 'pwm'">
                    <div class="flex gap-3 items-center">
                      <span class="text-xs text-gray-400 shrink-0">占空比</span>
                      <FaSlider
                        :model-value="[runtimeState(act).duty]" class="flex-1" :max="100" :step="1"
                        :disabled="actuatorCmdBusy === act.id"
                        @update:model-value="(val?: number[]) => onPwmDuty(act, (val && val[0] != null) ? val[0] : 0)"
                      />
                      <span class="text-sm font-semibold text-right w-12">{{ runtimeState(act).duty }}%</span>
                    </div>
                    <div class="flex flex-wrap gap-1">
                      <FaButton
                        v-for="preset in PWM_PRESETS" :key="preset" size="sm"
                        :variant="runtimeState(act).duty === preset ? 'default' : 'outline'"
                        :disabled="actuatorCmdBusy === act.id"
                        @click="onPwmDuty(act, preset)"
                      >
                        {{ preset }}%
                      </FaButton>
                    </div>
                    <div class="flex gap-1.5 items-center">
                      <span class="text-xs text-gray-400 shrink-0">脉宽 (µs)</span>
                      <FaInput
                        :model-value="runtimeState(act).pulseUs" type="number" class="w-32"
                        placeholder="如 1500" @update:model-value="(val: string) => (runtimeState(act).pulseUs = String(val))"
                      />
                      <FaButton size="sm" variant="outline" :disabled="actuatorCmdBusy === act.id" @click="onPwmPulseUs(act, runtimeState(act).pulseUs)">
                        发送
                      </FaButton>
                      <FaTag variant="secondary" class="ml-1">
                        云端换算：角度→脉宽在此输入
                      </FaTag>
                    </div>
                  </template>

                  <!-- spi：tx 输入（hex 串 / 数组文本） -->
                  <template v-else-if="transportOf(act) === 'spi'">
                    <div class="flex gap-1.5 items-center">
                      <FaInput
                        :model-value="runtimeState(act).txText" class="font-mono flex-1"
                        placeholder="如 A5 3C FF 或 [165,60,255]"
                        @update:model-value="(val: string) => (runtimeState(act).txText = val)"
                      />
                      <FaButton size="sm" variant="outline" :disabled="actuatorCmdBusy === act.id" @click="onSpiTx(act, runtimeState(act).txText)">
                        发送
                      </FaButton>
                    </div>
                  </template>

                  <!-- led_strip：开关 + 颜色（调色盘 → rgb） -->
                  <template v-else-if="transportOf(act) === 'led_strip'">
                    <FaSwitch
                      :model-value="runtimeState(act).on" :disabled="actuatorCmdBusy === act.id"
                      @update:model-value="(val?: boolean) => onLedStripToggle(act, val)"
                    />
                    <div class="flex gap-1.5 items-center">
                      <span class="text-xs text-gray-400 mr-1">颜色</span>
                      <el-color-picker
                        v-model="runtimeState(act).colorHex"
                        :disabled="actuatorCmdBusy === act.id"
                        :predefine="LED_COLOR_PRESETS"
                        @change="(color: string | null) => { if (color) onLedStripColor(act, color) }"
                      />
                    </div>
                  </template>

                  <!-- 旧版/未知 transport：提示编辑升级 -->
                  <div v-else class="text-xs text-amber-500">
                    定义缺少 config.transport（旧版驱动模型），请编辑后保存并重新下发
                  </div>
                </template>
                <div v-else class="text-xs text-gray-400">
                  已停用的执行器仅保留定义，重新启用并点击「下发设备」后设备才会重新实例化
                </div>
              </div>
            </div>
          </FaCard>
        </div>
      </div>
    </template>

    <!-- 编辑设备弹窗（基础资料必填 + 高级配置折叠） -->
    <DeviceEditDialog
      v-model="showDeviceEditDialog"
      :device="selectedDetail"
      advanced
      @saved="onDeviceSaved"
    />

    <!-- 新增 / 编辑传感器弹窗 -->
    <SensorEditDialog
      v-model="showSensorDialog"
      :device-id="selectedDetail?.deviceId ?? ''"
      :mode="sensorDialogMode"
      :sensor="editingSensor"
      @saved="onSensorSaved"
    />

    <!-- 新增 / 编辑执行器弹窗（定义仅持久化，改动后点「下发设备」生效） -->
    <ActuatorEditDialog
      v-model="showActuatorDialog"
      :device-id="selectedDetail?.deviceId ?? ''"
      :mode="actuatorDialogMode"
      :actuator="editingActuator"
      @saved="onActuatorSaved"
    />
  </FaPageMain>
</template>
