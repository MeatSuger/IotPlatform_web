<script setup lang="ts">
import type { TableColumn } from '@fantastic-admin/components'
import { deviceApi } from '@/api/modules/iot/device'

defineOptions({
  name: 'DeviceList',
})

interface DeviceRow {
  id: number | string
  deviceId: string
  deviceName: string
  deviceType: string
  status: 'ONLINE' | 'OFFLINE'
  lastActiveTime: string
  createdAt: string
  updatedAt: string
  firmwareVersion: string
  ipAddress: string
  macAddress: string
  location: string
  ownerId: number
}

const router = useRouter()
const { pagination, getParams, onSizeChange, onCurrentChange } = usePagination()

// 表格是否自适应高度
const tableAutoHeight = ref(true)

// 搜索
const searchDefault = {
  devicename: '',
}
const search = ref({ ...searchDefault })
function searchReset() {
  Object.assign(search.value, searchDefault)
}

// 批量操作
const batch = ref({
  enable: true,
  selectionDataList: [] as DeviceRow[],
})

// 列表
const loading = ref(false)
const dataList = ref<DeviceRow[]>([])

// 归一化字段命名，兼容真实后端与 fake mock 的返回差异
function normalize(row: any): DeviceRow {
  return {
    id: row.id ?? row.deviceId ?? 0,
    deviceId: row.deviceId || row.deviceid || row.id || '',
    deviceName: row.deviceName || row.devicename || row.name || '',
    deviceType: row.deviceType || row.devicetype || '',
    status: (row.status || '').toUpperCase() === 'OFFLINE' ? 'OFFLINE' : 'ONLINE',
    lastActiveTime: row.lastActiveTime || row.updatedAt || row.updated_at || row.lastOnline || '',
    createdAt: row.createdAt || row.created_at || '',
    updatedAt: row.updatedAt || row.updated_at || '',
    firmwareVersion: row.firmwareVersion || '',
    ipAddress: row.ipAddress || '',
    macAddress: row.macAddress || '',
    location: row.location || '',
    ownerId: row.ownerId || 0,
  }
}

const tableColumns = computed<TableColumn<DeviceRow>[]>(() => [
  { accessorKey: 'deviceId', header: '设备ID' },
  { accessorKey: 'deviceName', header: '设备名称' },
  { accessorKey: 'deviceType', header: '设备类型', width: 120, align: 'center' },
  { accessorKey: 'status', header: '状态', width: 90, align: 'center' },
  { accessorKey: 'lastActiveTime', header: '最后活跃', width: 180 },
  { accessorKey: 'location', header: '位置', width: 120 },
  {
    id: 'operation',
    header: '操作',
    width: 100,
    align: 'center',
    fixed: 'right',
  },
])

function formatTime(val: any): string {
  if (!val) {
    return '-'
  }
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) {
    return String(val)
  }
  return d.toLocaleString()
}

function getDataList() {
  loading.value = true
  const params = {
    ...getParams(),
    ...(search.value.devicename && { devicename: search.value.devicename }),
  }
  deviceApi.list(params).then((res: any) => {
    loading.value = false
    // 兼容两种返回格式：真实后端 { data: [...] } 与 fake mock { data: { list, total } }
    // 注意：axios 拦截器已解包一层，这里 res 即响应体 { code, message, data }，payload 在 res.data
    const raw = Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res?.data?.list)
        ? res.data.list
        : []
    dataList.value = raw.map(normalize)
    pagination.value.total = Array.isArray(res?.data) ? raw.length : (res?.data?.total ?? 0)
  }).catch((e: unknown) => {
    loading.value = false
    console.error('[DeviceList] load failed', e)
    const msg = e instanceof Error ? e.message : String(e)
    useFaToast().error('加载失败', { description: msg })
    dataList.value = []
    pagination.value.total = 0
  })
}

function sizeChange(size: number) {
  onSizeChange(size).then(() => getDataList())
}

function currentChange(page = 1) {
  onCurrentChange(page).then(() => getDataList())
}

function onCreate() {
  router.push({ name: 'AddDevice' })
}

function onMonitor(row: DeviceRow) {
  router.push({ name: 'MonitorIndex', query: { deviceId: row.deviceId } })
}

function onDel(row: DeviceRow) {
  useFaModal().confirm({
    title: '确认信息',
    content: `确认删除设备「${row.deviceName || row.deviceId}」吗？`,
    onConfirm: () => {
      deviceApi.delete(row.deviceId).then(() => {
        useFaToast().success('删除成功')
        getDataList()
      })
    },
  })
}

function onBatchDel() {
  const rows = batch.value.selectionDataList
  if (!rows.length) {
    return
  }

  useFaModal().confirm({
    title: '确认信息',
    content: `确认删除选中的 ${rows.length} 台设备吗？`,
    onConfirm: () => {
      Promise.all(rows.map(row => deviceApi.delete(row.deviceId))).then(() => {
        batch.value.selectionDataList = []
        useFaToast().success('批量删除成功')
        getDataList()
      })
    },
  })
}

// keepAlive 页面：每次激活刷新列表
onActivated(() => {
  getDataList()
})
</script>

<template>
  <div :class="{ 'absolute flex flex-col size-full': tableAutoHeight }">
    <FaPageHeader title="设备信息" class="mb-0" />
    <FaPageMain :class="{ 'flex-1 overflow-auto': tableAutoHeight }" :main-class="{ 'flex-1 flex flex-col overflow-auto': tableAutoHeight }">
      <FaSearchBar :show-toggle="false">
        <template #default="{ fold, toggle }">
          <div class="gap-x-8 gap-y-2 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
            <FaLabel label="设备名称" class="col-span-1">
              <FaInput
                v-model="search.devicename"
                placeholder="请输入设备名称，支持模糊查询"
                clearable
                class="w-full"
                @keydown.enter="currentChange()"
                @clear="currentChange()"
              />
            </FaLabel>
            <div class="flex gap-2 col-end--1 justify-end">
              <FaButton variant="outline" @click="searchReset(); currentChange()">
                重置
              </FaButton>
              <FaButton variant="default" @click="currentChange()">
                <FaIcon name="i-ri:search-line" />
                筛选
              </FaButton>
              <FaButton variant="ghost" @click="toggle">
                {{ fold ? '展开' : '收起' }}
                <FaIcon :name="fold ? 'i-ep:caret-bottom' : 'i-ep:caret-top'" />
              </FaButton>
            </div>
          </div>
        </template>
      </FaSearchBar>
      <div class="mx--4 my-3 border-t border-t-dashed" />
      <FaTable
        table-root-class="rounded-lg overflow-hidden"
        :class="{ 'min-h-0 flex-1': tableAutoHeight }"
        row-key="id"
        selectable
        multiple
        stripe
        border
        :columns="tableColumns"
        :data="dataList"
        @selection-change="batch.selectionDataList = $event"
      >
        <template #toolbar>
          <div class="flex flex-1 gap-2 items-center">
            <FaButton @click="onCreate">
              新增
            </FaButton>
            <FaDropdown
              v-if="batch.enable"
              :items="[
                [
                  { label: '批量删除', variant: 'destructive', disabled: !batch.selectionDataList.length, handle: onBatchDel },
                ],
              ]"
            >
              <FaButton variant="outline" :disabled="!batch.selectionDataList.length">
                批量操作
                <FaIcon name="i-ep:arrow-down" />
              </FaButton>
            </FaDropdown>
            <FaButton variant="outline" :loading="loading" @click="getDataList">
              刷新
            </FaButton>
          </div>
        </template>
        <template #cell-status="{ value }">
          <FaTag :variant="value === 'ONLINE' ? 'default' : 'secondary'">
            {{ value === 'ONLINE' ? '在线' : '离线' }}
          </FaTag>
        </template>
        <template #cell-lastActiveTime="{ value }">
          {{ formatTime(value) }}
        </template>
        <template #cell-deviceId="{ row }">
          <span class="text-primary cursor-pointer hover:underline" @click="onMonitor(row.original)">
            {{ row.original.deviceId }}
          </span>
        </template>
        <template #cell-operation="{ row }">
          <div class="flex-center gap-2">
            <FaButton variant="outline" size="icon-sm" @click="onMonitor(row.original)">
              <FaIcon name="i-ri:eye-line" />
            </FaButton>
            <FaDropdown
              :items="[
                [
                  { label: '删除', variant: 'destructive', handle: () => onDel(row.original) },
                ],
              ]"
            >
              <FaButton variant="outline" size="icon-sm">
                <FaIcon name="i-ri:more-line" />
              </FaButton>
            </FaDropdown>
          </div>
        </template>
      </FaTable>
      <FaPagination :page="pagination.page" :size="pagination.size" :total="pagination.total" class="mt-2" @page-change="currentChange" @size-change="sizeChange" />
    </FaPageMain>
  </div>
</template>
