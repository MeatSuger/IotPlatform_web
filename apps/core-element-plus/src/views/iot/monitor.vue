<script setup lang="ts">
import { useElementSize, useWindowSize } from '@vueuse/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef, watch } from 'vue'
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

const query = reactive({
  deviceId: '',
  keyword: '',
})

// 从路由 query 同步 deviceId
const route = useRoute()
function syncDeviceIdFromRoute() {
  const rid = route.query.deviceId
  if (typeof rid === 'string' && rid && rid !== query.deviceId) {
    query.deviceId = rid
    onQuery()
  }
}
syncDeviceIdFromRoute()

watch(
  () => route.query.deviceId,
  () => {
    syncDeviceIdFromRoute()
  },
)

onBeforeRouteUpdate((_to, _from, next) => {
  if (query.deviceId) {
    onQuery(true)
  }
  next()
})

// 数据与分页
const rawData = ref<Array<Record<string, any>>>([])
const currentPage = ref(1)
const pageSize = ref(20)
const loading = ref(false)

const filteredData = computed(() => {
  const kw = query.keyword?.trim()?.toLowerCase()
  if (!kw) {
    return rawData.value
  }
  return rawData.value.filter(
    (d: any) =>
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

function toNumber(v: unknown): number {
  const num = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''))
  return Number.isNaN(num) ? 0 : num
}

function parseDateSafe(s: string) {
  const t = Date.parse(s)
  return Number.isNaN(t) ? 0 : t
}

const timeAxis = computed(() => {
  const xs = Array.from(
    new Set(filteredData.value.map((d: any) => d.timestamp ?? d.time ?? d.date ?? '')),
  ) as string[]
  return xs.sort((a, b) => parseDateSafe(a) - parseDateSafe(b))
})

const seriesKeys = computed(() =>
  Array.from(new Set(filteredData.value.map((d: any) => d.type || d.name || 'value'))),
)

const chartOption = computed(() => {
  const xData = timeAxis.value
  const keys = seriesKeys.value
  const series = keys.map(key => ({
    name: key,
    type: 'line' as const,
    smooth: true,
    data: xData.map((t) => {
      const hit = filteredData.value.find(
        (d: any) => (d.type || d.name) === key && (d.timestamp ?? d.time ?? d.date ?? '') === t,
      )
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

// 自适应表格最大高度，避免页面级滚动
const { height: windowHeight } = useWindowSize()
const headerCardRef = useTemplateRef('headerCardRef')
const { height: cardHeaderHeight } = useElementSize(headerCardRef)
const tableMaxHeight = computed(() => {
  // 图表高度 280px + margin-bottom 12px + 分页高度约 50px + 卡片内边距约 40px + FaPageMain 边距 32px
  // 布局 overhead（顶部 slots + header + topbar + copyright 等）约 200px
  const overhead = 280 + 12 + 50 + 40 + 32 + 200 + (cardHeaderHeight.value || 60)
  return Math.max(150, windowHeight.value - overhead)
})

async function onQuery(silent = false) {
  if (!query.deviceId) {
    return
  }
  loading.value = true
  try {
    const res = await dataApi.getList(query.deviceId, {
      limit: Math.max(pageSize.value * 2, 20),
    })

    const list = Array.isArray(res?.data?.data)
      ? res.data.data
      : Array.isArray(res?.data)
        ? res.data
        : []
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

// 5 秒自动刷新
onMounted(() => {
  if (query.deviceId) {
    onQuery()
  }
  const timer = window.setInterval(() => {
    if (!loading.value) {
      onQuery(true)
    }
  }, 5000)

  onBeforeUnmount(() => {
    clearInterval(timer)
  })
})
</script>

<template>
  <FaPageMain class="h-[calc(100%-32px)]!">
    <el-card class="h-full!">
      <template #header>
        <div ref="headerCardRef">
          <el-form :model="query" :inline="true">
            <el-form-item label="日期范围">
              <el-date-picker
                v-model="dateRange"
                type="datetimerange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                :shortcuts="shortcuts"
              />
            </el-form-item>
            <el-form-item label="设备 ID">
              <el-input v-model="query.deviceId" placeholder="设备ID" clearable />
            </el-form-item>
            <el-form-item label="关键词">
              <el-input v-model="query.keyword" placeholder="" clearable />
            </el-form-item>
            <el-form-item label="">
              <el-button type="primary" :loading="loading" @click="onQuery()">
                查询
              </el-button>
            </el-form-item>
            <el-form-item label="">
              <el-button type="text">
                导出
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </template>

      <div class="flex flex-1 flex-col min-h-0">
        <!-- 折线图 -->
        <VChart class="chart shrink-0" :option="chartOption" autoresize />

        <!-- 数据表格 -->
        <div class="table-wrapper flex-1 min-h-0">
          <el-table
            :data="tablePageData"
            stripe
            border
            :max-height="tableMaxHeight"
            :loading="loading"
          >
            <el-table-column prop="timestamp" label="时间" show-overflow-tooltip align="center" />
            <el-table-column prop="name" label="名称" show-overflow-tooltip align="center" />
            <el-table-column prop="type" label="类型" show-overflow-tooltip align="center" />
            <el-table-column prop="value" label="数值" show-overflow-tooltip align="center" />
          </el-table>
        </div>

        <div class="pagination-wrap shrink-0">
          <el-pagination
            layout="prev, pager, next, sizes, total"
            :total="tableTotal"
            :current-page="currentPage"
            :page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            @current-change="onPageChange"
            @size-change="onPageSizeChange"
          />
        </div>
      </div>
    </el-card>
  </FaPageMain>
</template>

<style scoped>
.pagination-wrap {
  box-sizing: border-box;
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

/* 表格容器：填满剩余空间 */
.table-wrapper {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 确保 el-card 使用 flex 布局填满容器 */
:deep(.el-card) {
  display: flex;
  flex-direction: column;
}

:deep(.el-card__body) {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
</style>
