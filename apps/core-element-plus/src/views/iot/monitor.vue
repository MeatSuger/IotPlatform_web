<script setup lang="ts">
import type { TableColumn } from '@fantastic-admin/components'
import { LineChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, LegendComponent, ToolboxComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, useTemplateRef, watch } from 'vue'
import VChart from 'vue-echarts'
import { useRoute } from 'vue-router'
import { dataApi } from '@/api/modules/iot/data'
import { useAppSettingsStore } from '@/store/modules/app/settings'

defineOptions({ name: 'Monitor' })

use([CanvasRenderer, LineChart, DataZoomComponent, GridComponent, LegendComponent, ToolboxComponent, TooltipComponent])

// ==================== 查询条件 ====================
const query = reactive({
  deviceId: '',
  keyword: '',
})

const dateRange = ref<[Date, Date] | null>(null)
const shortcuts = [
  {
    text: '最近 24 小时',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 1)
      return [start, end]
    },
  },
  {
    text: '最近一周',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 7)
      return [start, end]
    },
  },
  {
    text: '最近一个月',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setMonth(start.getMonth() - 1)
      return [start, end]
    },
  },
]

// ==================== 数据 ====================
const rawData = ref<Array<Record<string, any>>>([])
const currentPage = ref(1)
const pageSize = ref(20)
const loading = ref(false)

function onReset() {
  dateRange.value = null
  query.keyword = ''
  query.deviceId = ''
  rawData.value = []
  currentPage.value = 1
}

// 客户端过滤（关键词 + 时间范围），与服务端过滤结果保持一致，轮询新数据也能即时生效
const filteredData = computed(() => {
  let list = rawData.value
  const kw = query.keyword?.trim()?.toLowerCase()
  if (kw) {
    list = list.filter((d: any) =>
      String(d.name ?? '').toLowerCase().includes(kw)
      || String(d.type ?? '').toLowerCase().includes(kw)
      || String(d.value ?? '').toLowerCase().includes(kw),
    )
  }
  const range = dateRange.value
  if (range) {
    const s = +range[0]
    const e = +range[1]
    list = list.filter((d: any) => {
      const t = Date.parse(d.timestamp ?? d.time ?? d.date ?? '')
      return !Number.isNaN(t) && t >= s && t <= e
    })
  }
  return list
})

const tableTotal = computed(() => filteredData.value.length)
const tablePageData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredData.value.slice(start, start + pageSize.value)
})

const typeMap: Record<string, string> = {
  temperature: '温度',
  humidity: '湿度',
  illuminance: '光照',
  pressure: '气压',
}

const columns: TableColumn<any>[] = [
  { accessorKey: 'timestamp', header: '时间' },
  { accessorKey: 'name', header: '名称' },
  { accessorKey: 'type', header: '类型', align: 'center' },
  { accessorKey: 'value', header: '数值', align: 'center' },
]

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

// ==================== 查询（时间范围随查询参数传给后端） ====================
function buildParams() {
  const range = dateRange.value
  return {
    limit: Math.max(pageSize.value * 2, 20),
    ...(range ? { startTime: +range[0], endTime: +range[1] } : {}),
  }
}

// 请求序列号：丢弃过期请求结果，避免路由同步与轮询并发时数据错乱
let querySeq = 0

async function onQuery(silent = false) {
  if (!query.deviceId) {
    return
  }
  const seq = ++querySeq
  loading.value = true
  try {
    const res = await dataApi.getList(query.deviceId, buildParams())
    if (seq !== querySeq) {
      return
    }
    // axios 拦截器已解包一层，payload 在 res.data
    const list = Array.isArray(res?.data) ? res.data : []
    rawData.value = list
    currentPage.value = 1
    startPolling()
    if (!silent) {
      useFaToast().success(`获取数据成功，共 ${list.length} 条`)
    }
  }
  catch (e) {
    console.error('[Monitor] fetch data failed', e)
    if (seq === querySeq && !silent) {
      useFaToast().error('获取数据失败', { description: '请稍后重试' })
    }
  }
  finally {
    if (seq === querySeq) {
      loading.value = false
    }
  }
}

function onPageChange(page: number) {
  currentPage.value = page
}
function onPageSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
}

// ==================== 路由参数同步（从设备列表跳转） ====================
const route = useRoute()
watch(() => route.query.deviceId, (val) => {
  const rid = typeof val === 'string' ? val : ''
  if (rid && rid !== query.deviceId) {
    query.deviceId = rid
    onQuery()
  }
}, { immediate: true })

// ==================== 定时轮询 ====================
const pollTimer = ref<number | null>(null)

function startPolling() {
  stopPolling()
  pollTimer.value = window.setInterval(() => {
    if (!loading.value && query.deviceId) {
      onQuery(true)
    }
  }, 5000)
}

function stopPolling() {
  if (pollTimer.value !== null) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

onMounted(() => {
  if (query.deviceId) {
    startPolling()
  }
})

// KeepAlive: 页面激活时恢复轮询并静默刷新，离开时停止
onActivated(() => {
  if (query.deviceId) {
    onQuery(true)
    startPolling()
  }
})

onDeactivated(() => {
  stopPolling()
})

onBeforeUnmount(() => {
  stopPolling()
})

// ==================== 图表 ====================
const appSettingsStore = useAppSettingsStore()
const chartTheme = computed(() => appSettingsStore.currentColorScheme === 'dark' ? 'dark' : '')

const chartRef = useTemplateRef('chartRef')

function enterZoomMode() {
  const instance = chartRef.value?.chart
  if (!instance) {
    return
  }
  instance.dispatchAction({
    type: 'takeGlobalCursor',
    key: 'dataZoomSelect',
    dataZoomSelectActive: true,
  })
}

function leaveZoomMode() {
  const instance = chartRef.value?.chart
  if (!instance) {
    return
  }
  instance.dispatchAction({
    type: 'takeGlobalCursor',
    key: 'dataZoomSelect',
    dataZoomSelectActive: false,
  })
}

function toNumber(v: unknown): number {
  const num = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''))
  return Number.isNaN(num) ? 0 : num
}
function parseDateSafe(s: string) {
  const t = Date.parse(s)
  return Number.isNaN(t) ? 0 : t
}

const timeAxis = computed(() => {
  const xs = Array.from(new Set(filteredData.value.map((d: any) => d.timestamp ?? d.time ?? d.date ?? ''))) as string[]
  return xs.sort((a, b) => parseDateSafe(a) - parseDateSafe(b))
})
const seriesKeys = computed(() => Array.from(new Set(filteredData.value.map((d: any) => d.type || d.name || 'value'))))

const chartOption = computed(() => {
  const xData = timeAxis.value
  const keys = seriesKeys.value
  const series = keys.map(key => ({
    name: key,
    type: 'line' as const,
    smooth: true,
    data: xData.map((t) => {
      const hit = filteredData.value.find((d: any) => (d.type || d.name) === key && (d.timestamp ?? d.time ?? d.date ?? '') === t)
      return hit ? toNumber((hit as any).value) : null
    }),
    showSymbol: false,
  }))
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: '#6a7985',
        },
      },
    },
    legend: {
      data: keys.map(k => typeMap[k] || k),
      top: 8,
    },
    toolbox: {
      right: 10,
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
        },
        restore: {},
        saveAsImage: {},
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: 40,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xData,
      axisLabel: {
        formatter: (v: string) => String(v).slice(11, 16),
      },
    },
    yAxis: {
      type: 'value',
    },
    series: series.map(s => ({
      ...s,
      areaStyle: {},
    })),
  }
})
</script>

<template>
  <FaPageMain class="!m-0 border-0! rounded-none! h-full! overflow-hidden!">
    <div class="flex flex-col gap-3 h-full">
      <!-- 查询区 -->
      <FaSearchBar :show-toggle="false" class="shrink-0">
        <template #default>
          <div class="gap-x-8 gap-y-2 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-end">
            <FaLabel label="设备ID">
              <FaInput
                v-model="query.deviceId"
                placeholder="请输入设备ID"
                clearable
                class="w-full"
                @keydown.enter="onQuery()"
                @clear="query.deviceId = ''"
              />
            </FaLabel>
            <FaLabel label="关键词">
              <FaInput
                v-model="query.keyword"
                placeholder="名称/类型/数值"
                clearable
                class="w-full"
                @keydown.enter="onQuery()"
              />
            </FaLabel>
            <FaLabel label="时间范围">
              <el-date-picker
                v-model="dateRange"
                type="datetimerange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                :shortcuts="shortcuts"
                class="w-full"
              />
            </FaLabel>
            <div class="flex gap-2 justify-end">
              <FaButton variant="outline" @click="onReset">
                重置
              </FaButton>
              <FaButton variant="default" :loading="loading" @click="onQuery()">
                <FaIcon name="i-ri:search-line" />
                查询
              </FaButton>
            </div>
          </div>
        </template>
      </FaSearchBar>

      <!-- 图表 -->
      <FaCard title="实时曲线" class="shrink-0">
        <div class="chart" @mouseenter="enterZoomMode" @mouseleave="leaveZoomMode">
          <VChart ref="chartRef" class="h-full w-full" :theme="chartTheme" :option="chartOption" autoresize />
        </div>
        <template #description>
          <span class="text-xs text-gray-500">鼠标悬停图表可框选缩放，滚轮可缩放</span>
        </template>
      </FaCard>

      <!-- 数据表格 -->
      <FaCard
        class="flex flex-1 flex-col min-h-0 overflow-hidden"
        content-class="flex-1 min-h-0 flex flex-col overflow-hidden"
      >
        <template #header>
          <div class="flex w-full items-center justify-between">
            <span>监测数据</span>
            <span v-if="query.deviceId" class="text-sm text-gray-500">
              设备：{{ query.deviceId }} · 共 {{ tableTotal }} 条
            </span>
          </div>
        </template>
        <div class="table-wrapper flex-1 min-h-0 overflow-auto">
          <FaTable :columns="columns" :data="tablePageData" stripe border>
            <template #cell-timestamp="{ value }">
              {{ formatTime(value) }}
            </template>
            <template #cell-type="{ value }">
              <FaTag variant="secondary">
                {{ typeMap[value] || value || '-' }}
              </FaTag>
            </template>
            <template #cell-value="{ value }">
              <span class="font-semibold">{{ value }}</span>
            </template>
          </FaTable>
        </div>
        <div class="pagination-wrap shrink-0">
          <FaPagination
            v-model:page="currentPage" v-model:size="pageSize" :total="tableTotal"
            :sizes="[10, 20, 50, 100]" @page-change="onPageChange" @size-change="onPageSizeChange"
          />
        </div>
      </FaCard>
    </div>
  </FaPageMain>
</template>

<style scoped>
.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  padding: 8px 0;
}

.chart {
  width: 100%;
  height: 280px;
}

.table-wrapper {
  display: flex;
  flex-direction: column;
}
</style>
