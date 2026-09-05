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

// 列表 / 卡片视图切换
const viewMode = ref<'list' | 'card'>('list')

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
  ...(batch.value.enable
    ? [{
      type: 'selection',
      fixed: 'left',
      width: 48,
    } satisfies TableColumn<DeviceRow>]
    : []),
  { accessorKey: 'deviceName', header: '设备名称', width: 160 },
  { accessorKey: 'deviceId', header: '设备ID' },
  { accessorKey: 'deviceType', header: '设备类型', width: 120, align: 'center' },
  { accessorKey: 'firmwareVersion', header: '固件版本', width: 110, align: 'center' },
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

function switchAutoHeight(enable: boolean) {
  tableAutoHeight.value = enable
}

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

function switchToList() {
  viewMode.value = 'list'
}

function switchToCard() {
  viewMode.value = 'card'
}

function onOpen(row: DeviceRow) {
  router.push({ name: 'DeviceControl', query: { deviceId: row.deviceId } })
}

function onEdit(row: DeviceRow) {
  router.push({ name: 'EditDevice', query: { deviceId: row.deviceId } })
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
    <FaPageHeader title="设备信息" class="mb-0">
      <template #description>
        <div class="flex gap-3 items-center">
          <span class="text-sm shrink-0">列表高度</span>
          <FaButtonGroup>
            <FaButton :variant="!tableAutoHeight ? 'default' : 'outline'" size="sm" @click="switchAutoHeight(false)">
              默认
            </FaButton>
            <FaButton :variant="tableAutoHeight ? 'default' : 'outline'" size="sm" @click="switchAutoHeight(true)">
              自适应
            </FaButton>
          </FaButtonGroup>
        </div>
      </template>
    </FaPageHeader>
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
      <!-- 顶部操作栏：列表/卡片切换 始终可见 -->
      <div class="mb-3 flex gap-2 items-center justify-between">
        <div class="flex gap-2 items-center">
          <FaButton @click="onCreate">
            新增
          </FaButton>
          <FaDropdown
            v-if="batch.enable && viewMode === 'list'"
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
        <FaButtonGroup>
          <FaButton :variant="viewMode === 'list' ? 'default' : 'outline'" size="sm" @click="switchToList">
            <FaIcon name="i-ri:list-unordered" />
            列表
          </FaButton>
          <FaButton :variant="viewMode === 'card' ? 'default' : 'outline'" size="sm" @click="switchToCard">
            <FaIcon name="i-ri:layout-grid-line" />
            卡片
          </FaButton>
        </FaButtonGroup>
      </div>
      <template v-if="viewMode === 'list'">
        <FaTable
          v-loading="loading"
          table-root-class="rounded-lg overflow-hidden"
          table-class="table-fixed"
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
          <template #cell-status="{ value }">
            <FaTag :variant="value === 'ONLINE' ? 'default' : 'secondary'">
              {{ value === 'ONLINE' ? '在线' : '离线' }}
            </FaTag>
          </template>
          <template #cell-lastActiveTime="{ value }">
            {{ formatTime(value) }}
          </template>
          <template #cell-deviceName="{ row }">
            <FaTooltip :delay="100" side="bottom" align="start">
              <div class="min-w-0 cursor-pointer" @click="onOpen(row.original)">
                <span class="text-primary leading-tight font-semibold underline decoration-1 underline-offset-2 block truncate hover:text-primary/80">{{ row.original.deviceName }}</span>
              </div>
              <template #content>
                <span class="cursor-pointer whitespace-nowrap hover:opacity-70" @click.stop="onEdit(row.original)">编辑</span>
              </template>
            </FaTooltip>
          </template>
          <template #cell-deviceId="{ value }">
            <span>{{ value }}</span>
          </template>
          <template #cell-operation="{ row }">
            <div class="flex-center gap-2">
              <FaButton variant="outline" size="icon-sm" @click="onEdit(row.original)">
                <FaIcon name="i-ri:edit-line" />
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
      </template>
      <!-- 卡片视图（参考 1Panel Docker 卡片布局） -->
      <template v-else>
        <FaEmpty v-if="!dataList.length" description="暂无设备数据" />
        <div
          v-else
          class="gap-3 grid grid-cols-1 2xl:grid-cols-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          <FaCard
            v-for="device in dataList"
            :key="device.id"
            class="!p-0! !gap-0! cursor-pointer transition-shadow overflow-hidden hover:shadow-md"
            content-class="!p-0!"
            @click="onOpen(device)"
          >
            <div class="px-4 py-2.5 border-b flex gap-2 items-center">
              <FaTooltip :delay="100" side="bottom" align="start">
                <span class="text-primary font-semibold underline decoration-1 underline-offset-2 min-w-0 truncate hover:text-primary/80">{{ device.deviceName }}</span>
                <template #content>
                  <span class="cursor-pointer whitespace-nowrap hover:opacity-70" @click.stop="onEdit(device)">编辑</span>
                </template>
              </FaTooltip>
              <div class="ml-auto flex shrink-0 gap-1.5 items-center">
                <FaTag :variant="device.status === 'ONLINE' ? 'default' : 'secondary'">
                  {{ device.status === 'ONLINE' ? '在线' : '离线' }}
                </FaTag>
                <div @click.stop>
                  <FaDropdown
                    :items="[
                      [
                        { label: '删除', variant: 'destructive', handle: () => onDel(device) },
                      ],
                    ]"
                  >
                    <FaButton variant="ghost" size="icon-sm">
                      <FaIcon name="i-ri:more-2-fill" />
                    </FaButton>
                  </FaDropdown>
                </div>
              </div>
            </div>
            <div class="text-sm px-4 py-3 flex flex-col gap-2">
              <div class="flex gap-3 items-center justify-between">
                <span class="text-gray-500 shrink-0">设备ID</span>
                <span class="font-medium min-w-0 truncate">{{ device.deviceId || '-' }}</span>
              </div>
              <div class="flex gap-3 items-center justify-between">
                <span class="text-gray-500 shrink-0">设备类型</span>
                <span class="font-medium min-w-0 truncate">{{ device.deviceType || '-' }}</span>
              </div>
              <div class="flex gap-3 items-center justify-between">
                <span class="text-gray-500 shrink-0">位置</span>
                <span class="font-medium min-w-0 truncate">{{ device.location || '-' }}</span>
              </div>
              <div class="flex gap-3 items-center justify-between">
                <span class="text-gray-500 shrink-0">最后活跃</span>
                <span class="font-medium min-w-0 truncate">{{ formatTime(device.lastActiveTime) }}</span>
              </div>
              <div class="flex gap-3 items-center justify-between">
                <span class="text-gray-500 shrink-0">IP</span>
                <span class="font-medium min-w-0 truncate">{{ device.ipAddress || '-' }}</span>
              </div>
            </div>
            <div class="px-4 py-2.5 border-t bg-accent/50">
              <FaButton variant="outline" size="sm" class="w-full" @click.stop="onEdit(device)">
                <FaIcon name="i-ri:edit-line" />
                编辑
              </FaButton>
            </div>
          </FaCard>
        </div>
      </template>
      <FaPagination :page="pagination.page" :size="pagination.size" :total="pagination.total" class="mt-2" @page-change="currentChange" @size-change="sizeChange" />
    </FaPageMain>
  </div>
</template>
