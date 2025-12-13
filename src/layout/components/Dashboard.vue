<template>
        <el-card class="mb-3">
                <div class="dashboard-page">
                        <h1>欢迎来到仪表盘</h1>
                        <p>这里是您的管理面板的概览。</p>
                </div>
        </el-card>

        <!-- 指标卡片（Element Plus 实现） -->
        <el-row :gutter="12">
                <el-col :xs="12" :sm="8" :md="6" v-for="card in cards" :key="card.title">
                        <el-card class="metric-card">
                                <div class="metric">
                                        <component :is="card.icon" style="width: 32px;" />
                                        <div style="display: flex; flex-direction: column;">
                                                <div class="metric-value">{{ card.value }}</div>
                                                <div class="metric-title">{{ card.title }}</div>
                                        </div>
                                </div>
                        </el-card>
                </el-col>
        </el-row>

        <!-- 实时数据图表 + 最新上报 -->
        <el-row :gutter="12" class="mt-4">
                <el-col :xs="24" :md="16">
                        <el-card class="section">
                                <div class="section-title">实时设备数据</div>
                                <v-chart class="chart" :option="lineChartOptions" autoresize />
                        </el-card>
                </el-col>
                <el-col :xs="24" :md="8">
                        <el-card class="section">
                                <div class="section-title">最新上报</div>
                                <el-table :data="recentData" border stripe size="small" :show-header="false">
                                        <el-table-column prop="device" />
                                        <el-table-column prop="value" />
                                </el-table>
                        </el-card>
                </el-col>
        </el-row>
</template>


<script lang="ts" setup>
import { ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])
const cards = ref([
        { title: '在线设备', value: 128, icon: 'Odometer' },
        { title: '离线设备', value: 12, icon: 'Close' },
        { title: '告警数量', value: 8, icon: 'Bell' },
        { title: '总设备数', value: 140, icon: 'Refrigerator' },
])

const recentData = ref([
        { device: '传感器 A', value: '温度 23℃' },
        { device: '传感器 B', value: '湿度 50%' },
        { device: '传感器 C', value: '电量 78%' },
        { device: '传感器 D', value: '温度 24℃' },
])

const lineChartOptions = ref({
        tooltip: { trigger: 'axis' },
        xAxis: {
                type: 'category',
                data: ['0:00', '1:00', '2:00', '3:00', '4:00', '5:00', '6:00']
        },
        yAxis: { type: 'value' },
        series: [{
                name: '温度',
                type: 'line',
                smooth: true,
                data: [22, 23, 21, 22, 24, 23, 22]
        }]
})
</script>


<style scoped>
.mb-3 {
        margin-bottom: 12px;
}

.mt-4 {
        margin-top: 16px;
}

.metric-card {
        text-align: left;
}

.metric {
        display: flex;
        flex-direction: row;
        gap: 6px;
}

.metric-value {
        font-size: 22px;
        font-weight: 600;
}

.metric-title {
        color: #666;
        font-size: 12px;
}

.section-title {
        font-weight: 600;
        margin-bottom: 8px;
}

.chart {
        width: 100%;
        height: 300px;
}
</style>
