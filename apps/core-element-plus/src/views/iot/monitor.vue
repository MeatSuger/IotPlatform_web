<script setup lang="ts">
import type { TableColumn } from '@fantastic-admin/components'
import { useElementSize, useWindowSize } from '@vueuse/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, useTemplateRef, watch } from 'vue'
import VChart from 'vue-echarts'
import { onBeforeRouteUpdate, useRoute } from 'vue-router'
import { dataApi } from '@/api/modules/iot/data'

defineOptions({ name: 'Monitor' })

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent])

const dateRange = ref('')
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

const query = reactive({ deviceId: '', keyword: '' })

const route = useRoute()
function syncDeviceIdFromRoute() {
  const rid = route.query.deviceId
  if (typeof rid === 'string' && rid && rid !== query.deviceId) {
    query.deviceId = rid
    onQuery()
  }
}
syncDeviceIdFromRoute()
watch(() => route.query.deviceId, () => {
  syncDeviceIdFromRoute()
})
onBeforeRouteUpdate((_to, _from, next) => {
  if (query.deviceId) {
    onQuery(true)
  }
  next()
})

const rawData = ref<Array<Record<string, any>>>([])
const currentPage = ref(1)
const pageSize = ref(20)
const loading = ref(false)

const filteredData = computed(() => {
  const kw = query.keyword?.trim()?.toLowerCase()
  if (!kw) {
    return rawData.value
  }
  return rawData.value.filter((d: any) =>
    String(d.name ?? '').toLowerCase().includes(kw)
    || String(d.type ?? '').toLowerCase().includes(kw)
    || String(d.value ?? '').toLowerCase().includes(kw)
    || String(d.timestamp ?? d.time ?? d.date ?? '').toLowerCase().includes(kw),
  )
})

const tableTotal = computed(() => filteredData.value.length)
const tablePageData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredData.value.slice(start, start + pageSize.value)
})

const columns: TableColumn<any>[] = [
  { accessorKey: 'timestamp', header: '时间', align: 'center' },
  { accessorKey: 'name', header: '名称', align: 'center' },
  { accessorKey: 'type', header: '类型', align: 'center' },
  { accessorKey: 'value', header: '数值', align: 'center' },
]

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
    title: { text: '监控指标趋势', left: 'center' },
    tooltip: { trigger: 'axis' },
    legend: { data: keys },
    grid: { left: '3%', right: '3%', bottom: '3%', top: 50, containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: xData },
    yAxis: { type: 'value' },
    series,
  }
})

const { height: windowHeight } = useWindowSize()
const headerCardRef = useTemplateRef('headerCardRef')
const { height: cardHeaderHeight } = useElementSize(headerCardRef)
const tableMaxHeight = computed(() => {
  const overhead = 280 + 12 + 50 + 40 + 32 + 200 + (cardHeaderHeight.value || 60)
  return Math.max(150, windowHeight.value - overhead)
})

async function onQuery(silent = false) {
  if (!query.deviceId) {
    return
  }
  loading.value = true
  try {
    const res = await dataApi.getList(query.deviceId, { limit: Math.max(pageSize.value * 2, 20) })
    const list = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : []
    rawData.value = list
    currentPage.value = 1
    if (!silent) {
      useFaToast().success(`获取数据成功，共 ${list.length} 条`)
    }
  }
  catch (e) {
    console.error('[Monitor] fetch data failed', e)
    if (!silent) {
      useFaToast().error('获取数据失败', { description: '请稍后重试' })
    }
  }
  finally {
    loading.value = false
  }
}

function onPageChange(page: number) {
  currentPage.value = page
}
function onPageSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
}

// 定时轮询
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
    onQuery()
    startPolling()
  }
})

// KeepAlive: 页面激活时恢复轮询，离开时停止
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
</script>

<template>
  <FaPageMain class="!m-0 border-0! rounded-none! h-full! overflow-hidden!">
    <FaCard class="flex flex-col h-full overflow-hidden">
      <template #header>
        <div ref="headerCardRef" class="flex shrink-0 flex-wrap gap-3 items-center">
          <el-date-picker
            v-model="dateRange" type="datetimerange" range-separator="至" start-placeholder="开始日期"
            end-placeholder="结束日期" :shortcuts="shortcuts"
          />
          <FaInput v-model="query.deviceId" placeholder="设备ID" class="!w-160px" />
          <FaInput v-model="query.keyword" placeholder="关键词" class="!w-160px" />
          <FaButton variant="default" size="sm" :loading="loading" @click="onQuery()">
            查询
          </FaButton>
          <FaButton variant="ghost" size="sm">
            导出
          </FaButton>
        </div>
      </template>

      <div class="flex flex-1 flex-col min-h-0">
        <VChart class="chart shrink-0" :option="chartOption" autoresize />
        <div class="table-wrapper flex-1 min-h-0" :style="{ maxHeight: `${tableMaxHeight}px` }">
          <FaTable :columns="columns" :data="tablePageData" stripe border />
        </div>
        <div class="pagination-wrap shrink-0">
          <FaPagination
            v-model:page="currentPage" v-model:size="pageSize" :total="tableTotal"
            :sizes="[10, 20, 50, 100]" @page-change="onPageChange" @size-change="onPageSizeChange"
          />
        </div>
      </div>
    </FaCard>
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
  margin-bottom: 12px;
}

.table-wrapper {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
