<script lang="ts" setup>
import type { TableColumn } from '@fantastic-admin/components'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { ref } from 'vue'
import VChart from 'vue-echarts'

defineOptions({ name: 'Dashboard' })

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const cards = ref([
  { title: '在线设备', value: 128, icon: 'i-material-symbols:speed-outline', color: 'text-green-500' },
  { title: '离线设备', value: 12, icon: 'i-material-symbols:close', color: 'text-red-500' },
  { title: '告警数量', value: 8, icon: 'i-material-symbols:notifications-outline', color: 'text-amber-500' },
  { title: '总设备数', value: 140, icon: 'i-material-symbols:devices-outline', color: 'text-blue-500' },
])

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

const lineChartOptions = ref({
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: ['0:00', '1:00', '2:00', '3:00', '4:00', '5:00', '6:00'] },
  yAxis: { type: 'value' },
  series: [{ name: '温度', type: 'line', smooth: true, data: [22, 23, 21, 22, 24, 23, 22] }],
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
      <FaCard title="实时设备数据" class="md:col-span-2">
        <VChart class="chart" :option="lineChartOptions" autoresize />
      </FaCard>
      <FaCard title="最新上报">
        <FaTable :columns="recentColumns" :data="recentData" stripe border />
      </FaCard>
    </div>
  </FaPageMain>
</template>

<style scoped>
.mb-3 { margin-bottom: 12px; }
.chart { width: 100%; height: 300px; }
</style>
