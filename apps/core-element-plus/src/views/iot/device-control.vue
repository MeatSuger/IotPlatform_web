<script setup lang="ts">
import type { TableColumn } from '@fantastic-admin/components'
import type { DeviceDetail, SensorItem } from '@/api/modules/iot/control'
import { controlApi } from '@/api/modules/iot/control'
import { deviceApi } from '@/api/modules/iot/device'
import { useDeviceWebSocket } from '@/composables/useDeviceWebSocket'

defineOptions({ name: 'DeviceControl' })

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

async function enterDetail(deviceId: string) {
  detailLoading.value = true
  try {
    const res = await controlApi.getDetail(deviceId)
    const data = res?.data?.data ?? res?.data
    selectedDetail.value = data as DeviceDetail
    viewMode.value = 'detail'
  }
  catch {
    useFaToast().error('获取设备详情失败')
  }
  finally {
    detailLoading.value = false
  }
}

function backToList() {
  viewMode.value = 'list'
  selectedDetail.value = null
}

// ==================== 传感器列 ====================
const sensorColumns: TableColumn<SensorItem>[] = [
  { accessorKey: 'name', header: '名称' },
  { accessorKey: 'identifier', header: '标识名' },
  { accessorKey: 'transferType', header: '传输类型', align: 'center' },
  { accessorKey: 'dataType', header: '数据类型', align: 'center' },
  { accessorKey: 'value', header: '当前值' },
]

// ==================== 控制器 ====================
type ControllerType = 'switch' | 'enum'
interface ControllerItem {
  id: string
  name: string
  identifier: string
  type: ControllerType
  value: boolean | string
  options?: string[]
}

const controllerStore = ref<Record<string, ControllerItem[]>>(
  JSON.parse(localStorage.getItem('iot_controllers') || '{}'),
)
watch(controllerStore, (val) => {
  localStorage.setItem('iot_controllers', JSON.stringify(val))
}, { deep: true })

const currentControllers = computed(() => {
  if (!selectedDetail.value) {
    return []
  }
  return controllerStore.value[selectedDetail.value.deviceId] || []
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
  if (!controllerStore.value[key]) {
    controllerStore.value[key] = []
  }
  controllerStore.value[key].push(newCtrl)
  showAddDialog.value = false
}

function removeController(ctrlId: string) {
  if (!selectedDetail.value) {
    return
  }
  const key = selectedDetail.value.deviceId
  controllerStore.value[key] = (controllerStore.value[key] || []).filter(
    (c: ControllerItem) => c.id !== ctrlId,
  )
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

// ==================== 加载设备列表 ====================
async function loadDeviceList() {
  listLoading.value = true
  try {
    const res = await deviceApi.list()
    const list = Array.isArray(res?.data?.data)
      ? res.data.data
      : Array.isArray(res?.data)
        ? res.data
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

onMounted(() => {
  loadDeviceList()
  wsConnect('')
})

onBeforeUnmount(() => {
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
          :columns="deviceColumns"
          :data="deviceList"
          table-root-class="rounded-lg overflow-hidden"
          stripe
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
      <div class="flex shrink-0 gap-3 items-center">
        <FaButton variant="ghost" size="sm" @click="backToList">
          ← 返回列表
        </FaButton>
        <span class="font-semibold">{{ selectedDetail?.deviceName }}（{{ selectedDetail?.deviceId }}）</span>
        <FaTag :variant="selectedDetail?.status === 'ONLINE' ? 'default' : 'destructive'">
          {{ selectedDetail?.status === 'ONLINE' ? '在线' : '离线' }}
        </FaTag>
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
          <FaCard
            title="传感器"
            class="flex-1 min-w-0"
            content-class="flex-1 min-h-0 overflow-auto"
          >
            <template #header>
              <div class="flex w-full items-center justify-between">
                <span>传感器</span>
              </div>
            </template>
            <FaTable
              v-if="selectedDetail?.sensors?.length"
              :columns="sensorColumns"
              :data="selectedDetail.sensors"
              table-root-class="rounded-lg overflow-hidden"
              stripe
              border
            >
              <template #cell-value="{ value, row }">
                <span class="font-semibold">{{ value }}{{ row.original.unit ?? '' }}</span>
              </template>
            </FaTable>
            <FaEmpty v-else description="无传感器数据" />
          </FaCard>

          <FaCard
            title="控制器"
            class="p-3 flex-1 min-w-0"
            content-class="flex-1 min-h-0 overflow-auto"
          >
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
              <div
                v-for="ctrl in currentControllers"
                :key="ctrl.id"
                class="p-3 border rounded-lg flex flex-col gap-2"
              >
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium truncate">{{ ctrl.name }}</span>
                  <FaButton
                    variant="ghost"
                    size="icon"
                    class="text-gray-400 size-6 hover:text-red-500"
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
                    :model-value="(ctrl.value as boolean)"
                    :loading="controllerCmdLoading"
                    @update:model-value="ctrl.value = ($event as boolean); toggleController(ctrl)"
                  />
                </template>

                <template v-else>
                  <div class="flex flex-wrap gap-1">
                    <FaButton
                      v-for="opt in ctrl.options"
                      :key="opt"
                      :variant="ctrl.value === opt ? 'default' : 'outline'"
                      size="sm"
                      :loading="controllerCmdLoading"
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

    <!-- 添加控制器弹窗 -->
    <FaModal
      v-model="showAddDialog"
      title="添加控制器"
      show-cancel-button
      @confirm="addController"
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
            v-model="controllerForm.type"
            :options="[
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
