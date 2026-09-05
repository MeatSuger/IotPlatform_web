<script setup lang="ts">
import type { TableColumn } from '@fantastic-admin/components'
import * as echarts from 'echarts'

defineOptions({ name: 'Dashboard' })

// 指标卡（静态演示数据，后续接入真实设备统计）
const cards = ref([
  { title: '在线设备', value: 128, icon: 'i-ri:computer-line', color: 'text-green-500' },
  { title: '离线设备', value: 12, icon: 'i-ri:close-circle-line', color: 'text-red-500' },
  { title: '告警数量', value: 8, icon: 'i-ri:notification-3-line', color: 'text-amber-500' },
  { title: '总设备数', value: 140, icon: 'i-ri:apps-2-line', color: 'text-blue-500' },
])

// 最新上报（静态演示数据）
const recentData = ref([
  { device: '传感器 A', value: '温度 23℃' },
  { device: '传感器 B', value: '湿度 50%' },
  { device: '传感器 C', value: '电量 78%' },
  { device: '传感器 D', value: '温度 24℃' },
])

const recentColumns: TableColumn<any>[] = [
  { accessorKey: 'device' },
  { accessorKey: 'value' },
]

// ==================== 命令式 echarts（参照 example/echarts.vue） ====================
const trendChartRef = useTemplateRef<HTMLDivElement>('trendChartRef')
const typeChartRef = useTemplateRef<HTMLDivElement>('typeChartRef')
let trendChart: echarts.ECharts | null = null
let typeChart: echarts.ECharts | null = null

function initCharts() {
  if (!trendChartRef.value || !typeChartRef.value) {
    return
  }
  trendChart = echarts.init(trendChartRef.value)
  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['温度', '湿度'], top: 8 },
    grid: { left: '3%', right: '4%', bottom: '3%', top: 40, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '温度',
        type: 'line',
        smooth: true,
        showSymbol: false,
        areaStyle: {},
        data: [22, 23, 21, 22, 24, 23, 22],
      },
      {
        name: '湿度',
        type: 'line',
        smooth: true,
        showSymbol: false,
        areaStyle: {},
        data: [48, 52, 55, 50, 47, 51, 49],
      },
    ],
  })

  typeChart = echarts.init(typeChartRef.value)
  typeChart.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 8 },
    series: [
      {
        name: '设备类型',
        type: 'pie',
        radius: ['40%', '68%'],
        center: ['50%', '45%'],
        data: [
          { value: 60, name: '温度传感器' },
          { value: 45, name: '湿度传感器' },
          { value: 20, name: '智能网关' },
          { value: 15, name: '环境监测' },
        ],
      },
    ],
  })
}

function resizeCharts() {
  trendChart?.resize()
  typeChart?.resize()
}

onMounted(() => {
  initCharts()
  window.addEventListener('resize', resizeCharts)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  trendChart?.dispose()
  typeChart?.dispose()
  trendChart = null
  typeChart = null
})
</script>

<template>
  <FaPageMain>
    <FaCard class="mb-3">
      <div class="dashboard-page">
        <h1>欢迎来到仪表盘</h1>
        <p>这里是您的管理面板的概览。</p>
      </div>
    </FaCard>

    <!-- 指标卡片 -->
    <div class="mb-3 gap-3 grid grid-cols-2 sm:grid-cols-4">
      <FaCard v-for="card in cards" :key="card.title">
        <div class="flex gap-2 items-center">
          <FaIcon :name="card.icon" :class="card.color" class="text-2xl" />
          <div class="flex flex-col">
            <span class="text-xl font-semibold">{{ card.value }}</span>
            <span class="text-xs text-gray-500">{{ card.title }}</span>
          </div>
        </div>
      </FaCard>
    </div>

    <!-- 图表 + 最新上报 -->
    <div class="gap-3 grid grid-cols-1 md:grid-cols-3">
      <FaCard title="近 7 天温湿度趋势" class="md:col-span-2">
        <div ref="trendChartRef" class="h-[320px] w-full" />
      </FaCard>
      <FaCard title="设备类型分布">
        <div ref="typeChartRef" class="h-[320px] w-full" />
      </FaCard>
      <FaCard title="最新上报" class="md:col-span-3">
        <FaTable :columns="recentColumns" :data="recentData" stripe border />
      </FaCard>
    </div>
  </FaPageMain>
</template>
