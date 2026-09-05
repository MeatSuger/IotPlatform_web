<script setup lang="ts">
import type { TableColumn } from '@fantastic-admin/components'
import type { DeviceLogItem, DeviceLogType } from '@/api/modules/iot/log'
import { logApi } from '@/api/modules/iot/log'

defineOptions({
  name: 'LogDevice',
})

const route = useRoute()
const router = useRouter()

const deviceId = ref(String(route.query.deviceId ?? ''))

// 搜索/筛选（注意：Reka Select 不允许空字符串 value，「全部」用 placeholder 表示）
const typeOptions: Array<{ label: string, value: DeviceLogType }> = [
  { label: '上线', value: 'online' },
  { label: '下线', value: 'offline' },
  { label: '命令', value: 'command' },
  { label: '配置', value: 'config' },
  { label: '传感器', value: 'sensor' },
]
const search = ref<{ type: DeviceLogType | '' }>({ type: '' })

// 列表
const loading = ref(false)
const dataList = ref<DeviceLogItem[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const typeMap: Record<string, string> = {
  online: '上线',
  offline: '下线',
  command: '命令',
  config: '配置',
  sensor: '传感器',
}

const columns = computed<TableColumn<DeviceLogItem>[]>(() => [
  { accessorKey: 'createdAt', header: '时间', width: 190 },
  { accessorKey: 'type', header: '类型', width: 90, align: 'center' },
  { accessorKey: 'deviceId', header: '设备ID', width: 120 },
  { accessorKey: 'content', header: '内容' },
  { accessorKey: 'detail', header: '详情' },
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
  if (!deviceId.value) {
    return
  }
  loading.value = true
  const params = {
    pageNum: currentPage.value - 1,
    pageSize: pageSize.value,
    ...(search.value.type && { type: search.value.type }),
  }
  logApi.getList(deviceId.value, params).then((res: any) => {
    loading.value = false
    // 兼容真实后端 { data: { records, total } } 与可能直接返回数组两种形态
    const data = res?.data?.data ?? res?.data
    if (Array.isArray(data)) {
      dataList.value = data
      total.value = data.length
    }
    else if (data && Array.isArray(data.records)) {
      dataList.value = data.records
      total.value = data.total ?? 0
    }
    else {
      dataList.value = []
      total.value = 0
    }
  }).catch((e: unknown) => {
    loading.value = false
    console.error('[LogDevice] load failed', e)
    useFaToast().error('加载日志失败', { description: '预留接口暂不可用或后端未实现' })
    dataList.value = []
    total.value = 0
  })
}

function searchReset() {
  search.value.type = ''
  currentPage.value = 1
  getDataList()
}

function currentChange(page = 1) {
  currentPage.value = page
  getDataList()
}

function sizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
  getDataList()
}

function goBack() {
  router.back()
}

watch(() => route.query.deviceId, (val) => {
  const id = typeof val === 'string' ? val : ''
  if (id && id !== deviceId.value) {
    deviceId.value = id
    currentPage.value = 1
    getDataList()
  }
}, { immediate: true })
</script>

<template>
  <div>
    <FaPageHeader title="设备日志" class="mb-0">
      <template #description>
        <div class="flex gap-3 items-center">
          <FaButton variant="ghost" size="sm" @click="goBack">
            ← 返回
          </FaButton>
          <span v-if="deviceId" class="text-sm text-gray-500">设备 ID：{{ deviceId }}</span>
        </div>
      </template>
    </FaPageHeader>
    <FaPageMain>
      <FaSearchBar :show-toggle="false">
        <template #default>
          <div class="gap-x-8 gap-y-2 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-end">
            <FaLabel label="事件类型" class="col-span-1">
              <FaSelect v-model="search.type" :options="typeOptions" placeholder="全部类型" class="w-full" />
            </FaLabel>
            <div class="flex gap-2 col-end--1 justify-end">
              <FaButton variant="outline" @click="searchReset">
                重置
              </FaButton>
              <FaButton variant="default" @click="currentChange(1)">
                <FaIcon name="i-ri:search-line" />
                筛选
              </FaButton>
            </div>
          </div>
        </template>
      </FaSearchBar>
      <div class="mx--4 my-3 border-t border-t-dashed" />
      <FaTable
        v-loading="loading"
        row-key="id"
        stripe
        border
        :columns="columns"
        :data="dataList"
      >
        <template #cell-createdAt="{ value }">
          {{ formatTime(value) }}
        </template>
        <template #cell-type="{ value }">
          <FaTag :variant="value === 'offline' ? 'secondary' : 'default'">
            {{ typeMap[value as string] || value || '-' }}
          </FaTag>
        </template>
        <template #cell-detail="{ value }">
          <span class="text-xs text-gray-500 font-mono">{{ value || '-' }}</span>
        </template>
      </FaTable>
      <FaPagination
        :page="currentPage"
        :size="pageSize"
        :total="total"
        class="mt-2"
        @page-change="currentChange"
        @size-change="sizeChange"
      />
    </FaPageMain>
  </div>
</template>
