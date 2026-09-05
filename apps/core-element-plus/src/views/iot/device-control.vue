<script setup lang="ts">
import type { FormExpose, TableColumn } from '@fantastic-admin/components'
import type { DeviceDetail } from '@/api/modules/iot/control'
import type { Sensor, SensorCreatePayload, SensorSpecs, SensorThresholds, SensorUpdatePayload } from '@/api/modules/iot/sensor'
import type { ControllerItem, ControllerType } from '@/store/modules/controller'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { controlApi } from '@/api/modules/iot/control'
import { deviceApi } from '@/api/modules/iot/device'
import { sensorApi } from '@/api/modules/iot/sensor'
import { useDeviceWebSocket } from '@/composables/useDeviceWebSocket'
import DeviceEditDialog from './components/DeviceEditDialog.vue'

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
    // 先拉取传感器配置（值随后由设备详情填充）
    fetchSensorConfig(deviceId)
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

// ==================== 传感器定义（物模型）+ 数值展示 ====================
// 定义从后端拉取存本地（值先空置），数值由设备详情匹配填充
export interface DisplaySensor extends Sensor {
  value: string
}

const sensorConfigs = ref<Sensor[]>([])
const sensorViewMode = ref<'list' | 'grid'>('list')

async function fetchSensorConfig(deviceId: string) {
  try {
    const res: any = await sensorApi.getList(deviceId)
    const data = res?.data?.data ?? res?.data
    sensorConfigs.value = Array.isArray(data) ? data : []
  }
  catch (e) {
    console.warn('[DeviceControl] fetch sensor config failed, fallback to detail sensors:', e)
    sensorConfigs.value = []
  }
}

// 定义决定展示哪些传感器，数值按标识（id = 上报值 type）匹配填充
const displaySensors = computed<DisplaySensor[]>(() => {
  const values = (selectedDetail.value?.sensors ?? []) as Array<Record<string, any>>
  if (!sensorConfigs.value.length) {
    return values.map(v => ({
      id: String(v.type ?? v.name ?? ''),
      name: String(v.name ?? ''),
      type: String(v.type ?? ''),
      value: v.value != null ? String(v.value) : '',
    }))
  }
  return sensorConfigs.value.map((config) => {
    const hit = values.find(v =>
      v.type === config.id
      || v.id === config.id
      || v.name === config.id
      || v.name === config.name,
    )
    return {
      ...config,
      value: hit && hit.value != null ? String(hit.value) : '',
    }
  })
})

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

// ==================== 新增 / 编辑 / 删除 传感器定义（弹窗 FaForm） ====================
const sensorTypeOptions = [
  { label: '温度 (temperature)', value: 'temperature' },
  { label: '湿度 (humidity)', value: 'humidity' },
  { label: '光照 (light)', value: 'light' },
  { label: '开关 (switch)', value: 'switch' },
  { label: '自定义 (custom)', value: 'custom' },
]

const sensorDataTypeOptions = [
  { label: '浮点 (float)', value: 'float' },
  { label: '整数 (int)', value: 'int' },
  { label: '布尔 (bool)', value: 'bool' },
  { label: '文本 (text)', value: 'text' },
  { label: '枚举 (enum)', value: 'enum' },
]

const showSensorDialog = ref(false)
const sensorDialogMode = ref<'add' | 'edit'>('add')
const sensorSaving = ref(false)
const editingSensorId = ref('')

interface SensorFormModel {
  id: string
  name: string
  type: string
  dataType: string
  unit: string
  reportInterval: string
  enabled: boolean
  specs: { min: string, max: string, step: string }
  thresholds: { min: string, max: string, alarm: boolean }
  attrsRows: { key: string, value: string }[]
}

const sensorFormRef = useTemplateRef<FormExpose>('sensorFormRef')

const sensorFormModel = ref<SensorFormModel>({
  id: '',
  name: '',
  type: 'temperature',
  dataType: 'float',
  unit: '',
  reportInterval: '60',
  enabled: true,
  specs: { min: '', max: '', step: '' },
  thresholds: { min: '', max: '', alarm: false },
  attrsRows: [],
})

const sensorValidationSchema = toTypedSchema(z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{0,49}$/, '小写字母开头，仅含小写字母/数字/下划线，≤50'),
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

function resetSensorFormModel() {
  sensorFormModel.value = {
    id: '',
    name: '',
    type: 'temperature',
    dataType: 'float',
    unit: '',
    reportInterval: '60',
    enabled: true,
    specs: { min: '', max: '', step: '' },
    thresholds: { min: '', max: '', alarm: false },
    attrsRows: [],
  }
}

function openAddSensorDialog() {
  sensorDialogMode.value = 'add'
  editingSensorId.value = ''
  resetSensorFormModel()
  showSensorDialog.value = true
}

function openEditSensorDialog(sensor: DisplaySensor) {
  sensorDialogMode.value = 'edit'
  editingSensorId.value = sensor.id
  const specs = sensor.specs ?? {}
  const thresholds = sensor.thresholds ?? {}
  const attrs = sensor.attrs ?? {}
  sensorFormModel.value = {
    id: sensor.id,
    name: sensor.name,
    type: sensor.type || 'temperature',
    dataType: sensor.dataType ?? 'float',
    unit: sensor.unit ?? '',
    reportInterval: sensor.reportInterval != null ? String(sensor.reportInterval) : '60',
    enabled: sensor.enabled ?? true,
    specs: {
      min: specs.min != null ? String(specs.min) : '',
      max: specs.max != null ? String(specs.max) : '',
      step: specs.step != null ? String(specs.step) : '',
    },
    thresholds: {
      min: thresholds.min != null ? String(thresholds.min) : '',
      max: thresholds.max != null ? String(thresholds.max) : '',
      alarm: thresholds.alarm ?? false,
    },
    attrsRows: Object.entries(attrs).map(([key, value]) => ({ key, value: String(value) })),
  }
  showSensorDialog.value = true
}

function addAttrRow() {
  sensorFormModel.value.attrsRows.push({ key: '', value: '' })
}

function removeAttrRow(index: number) {
  sensorFormModel.value.attrsRows.splice(index, 1)
}

// 组装提交载荷：specs/thresholds/attrs 为空子键时省略
function buildSensorPayload(): SensorUpdatePayload {
  const m = sensorFormModel.value
  const payload: SensorUpdatePayload = {
    name: m.name.trim(),
    type: m.type,
    dataType: m.dataType as Sensor['dataType'],
    unit: m.unit.trim(),
    reportInterval: toNumber(m.reportInterval) ?? 0,
    enabled: m.enabled,
  }

  const specs: SensorSpecs = {}
  const min = toNumber(m.specs.min)
  const max = toNumber(m.specs.max)
  const step = toNumber(m.specs.step)
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
  const tMin = toNumber(m.thresholds.min)
  const tMax = toNumber(m.thresholds.max)
  if (tMin != null) {
    thresholds.min = tMin
  }
  if (tMax != null) {
    thresholds.max = tMax
  }
  if (m.thresholds.alarm) {
    thresholds.alarm = true
  }
  if (Object.keys(thresholds).length) {
    payload.thresholds = thresholds
  }

  const attrs: Record<string, string> = {}
  m.attrsRows.forEach((row) => {
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

async function onSensorSubmit() {
  const deviceId = selectedDetail.value?.deviceId
  if (!deviceId) {
    return
  }
  const payload = buildSensorPayload()
  sensorSaving.value = true
  try {
    if (sensorDialogMode.value === 'add') {
      const { name: nameVal, type: typeVal, ...restPayload } = payload
      const createPayload: SensorCreatePayload = {
        ...restPayload,
        id: sensorFormModel.value.id.trim(),
        name: nameVal ?? '',
        type: typeVal ?? '',
      }
      await sensorApi.create(deviceId, createPayload)
      useFaToast().success('传感器添加成功')
    }
    else {
      await sensorApi.update(deviceId, editingSensorId.value, payload)
      useFaToast().success('传感器更新成功')
    }
    showSensorDialog.value = false
    await fetchSensorConfig(deviceId)
  }
  catch {
    useFaToast().error(sensorDialogMode.value === 'add' ? '传感器添加失败' : '传感器更新失败')
  }
  finally {
    sensorSaving.value = false
  }
}

function confirmSensorDialog() {
  sensorFormRef.value?.submit()
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
        await fetchSensorConfig(deviceId)
      }
      catch {
        useFaToast().error('传感器删除失败')
      }
    },
  })
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

  dispatchLoading.value = true
  try {
    // 1. 下发传感器定义配置（编译进 config 并版本化下发，HTTP；离线也入队待设备拉取）
    const applyRes: any = await sensorApi.apply(deviceId)
    const applyData = applyRes?.data?.data ?? applyRes?.data
    if (applyData?.version != null) {
      useFaToast().success(`传感器配置已下发（version ${applyData.version}，共 ${applyData.count ?? 0} 项）`)
    }
    else {
      useFaToast().success('传感器配置已下发')
    }

    // 2. 控制器指令走 WebSocket（未连接或暂无控制器时跳过，不阻塞配置下发）
    const controllers = currentControllers.value
    if (controllers.length) {
      if (wsConnected.value) {
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
        useFaToast().success('控制器指令已下发')
      }
      else {
        useFaToast().warning('WebSocket 未连接，控制器指令未下发')
      }
    }
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
                  <span class="font-semibold">{{ row.original.value || '-' }}{{ row.original.unit ?? '' }}</span>
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
                      <span class="text-primary font-semibold min-w-0 truncate">{{ sensor.value || '-' }}{{ sensor.unit ?? '' }}</span>
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

          <FaCard title="控制器" class="p-3 flex-1 min-w-0" content-class="flex-1 min-h-0 overflow-auto">
            <template #header>
              <div class="flex w-full items-center justify-between">
                <span>控制器</span>
                <FaButton variant="outline" size="sm" @click="openAddDialog">
                  <FaIcon name="i-ri:add-line" class="mr-1 size-4" />
                  添加
                </FaButton>
              </div>
            </template>
            <el-empty v-if="currentControllers.length === 0" description="暂无控制器，点击添加" />
            <div v-else class="flex flex-col gap-3">
              <div v-for="ctrl in currentControllers" :key="ctrl.id" class="p-3 border rounded-lg flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium truncate">{{ ctrl.name }}</span>
                  <FaButton
                    variant="ghost" size="icon" class="text-gray-400 size-6 hover:text-red-500"
                    @click="removeController(ctrl.id)"
                  >
                    <FaIcon name="i-ri:close-line" class="size-3.5" />
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

    <!-- 编辑设备弹窗（基础资料必填 + 高级配置折叠） -->
    <DeviceEditDialog
      v-model="showDeviceEditDialog"
      :device="selectedDetail"
      advanced
      @saved="onDeviceSaved"
    />

    <!-- 新增 / 编辑传感器弹窗 -->
    <FaModal
      v-model="showSensorDialog" :title="sensorDialogMode === 'add' ? '添加传感器' : '编辑传感器'"
      show-cancel-button :confirm-button-loading="sensorSaving" @confirm="confirmSensorDialog"
      @cancel="showSensorDialog = false"
    >
      <FaForm
        v-if="showSensorDialog"
        ref="sensorFormRef"
        :model="sensorFormModel"
        :validation-schema="sensorValidationSchema"
        class="gap-3 grid grid-cols-2 min-w-0"
        @submit="onSensorSubmit"
      >
        <FaFormItem name="id" label="标识 (id)" class="col-span-1" required>
          <FaInput placeholder="如 temperature" :disabled="sensorDialogMode === 'edit'" class="w-full" />
        </FaFormItem>
        <FaFormItem name="name" label="名称" class="col-span-1" required>
          <FaInput placeholder="如：温度" class="w-full" />
        </FaFormItem>
        <FaFormItem name="type" label="类别" class="col-span-1" required>
          <FaSelect :options="sensorTypeOptions" class="w-full" />
        </FaFormItem>
        <FaFormItem name="dataType" label="数据类型" class="col-span-1" required>
          <FaSelect :options="sensorDataTypeOptions" class="w-full" />
        </FaFormItem>
        <FaFormItem name="unit" label="单位" class="col-span-1">
          <FaInput placeholder="如：°C、%RH" class="w-full" />
        </FaFormItem>
        <div class="flex flex-col gap-1 col-span-1">
          <label class="text-sm font-medium">上报周期 (s)</label>
          <FaInput v-model="sensorFormModel.reportInterval" type="number" placeholder="0 = 继承设备全局" class="w-full" />
        </div>
        <div class="flex gap-3 col-span-2 items-center">
          <label class="text-sm font-medium">启用</label>
          <FaSwitch v-model="sensorFormModel.enabled" />
        </div>

        <!-- 量程 specs -->
        <div class="flex flex-col gap-1 col-span-2">
          <span class="text-sm font-medium">量程 (specs)</span>
          <div class="gap-3 grid grid-cols-3">
            <FaInput v-model="sensorFormModel.specs.min" type="number" placeholder="min" class="w-full" />
            <FaInput v-model="sensorFormModel.specs.max" type="number" placeholder="max" class="w-full" />
            <FaInput v-model="sensorFormModel.specs.step" type="number" placeholder="step" class="w-full" />
          </div>
        </div>

        <!-- 阈值 thresholds -->
        <div class="flex flex-col gap-2 col-span-2">
          <span class="text-sm font-medium">告警阈值 (thresholds)</span>
          <div class="gap-3 grid grid-cols-2">
            <FaInput v-model="sensorFormModel.thresholds.min" type="number" placeholder="min" class="w-full" />
            <FaInput v-model="sensorFormModel.thresholds.max" type="number" placeholder="max" class="w-full" />
          </div>
          <div class="flex gap-3 items-center">
            <label class="text-sm font-medium">告警</label>
            <FaSwitch v-model="sensorFormModel.thresholds.alarm" />
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
          <div v-if="sensorFormModel.attrsRows.length" class="flex flex-col gap-2">
            <div v-for="(row, index) in sensorFormModel.attrsRows" :key="index" class="flex gap-2 items-center">
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

    <!-- 添加控制器弹窗 -->
    <FaModal
      v-model="showAddDialog" title="添加控制器" show-cancel-button @confirm="addController"
      @cancel="showAddDialog = false"
    >
      <div class="py-2 flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">名称</label>
          <FaInput v-model="controllerForm.name" placeholder="如：电源开关、运行模式" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">标识名 (GPIO)</label>
          <FaInput v-model="controllerForm.identifier" placeholder="如：1、2、3" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">类型</label>
          <FaSelect
            v-model="controllerForm.type"
            class="w-full" :options="[
              { label: '开关', value: 'switch' },
              { label: '枚举', value: 'enum' },
            ]"
          />
        </div>
        <div v-if="controllerForm.type === 'enum'" class="flex flex-col gap-1">
          <label class="text-sm font-medium">选项（逗号分隔）</label>
          <FaInput v-model="controllerForm.options" placeholder="如：auto,cool,heat,fan" class="w-full" />
        </div>
      </div>
    </FaModal>
  </FaPageMain>
</template>
