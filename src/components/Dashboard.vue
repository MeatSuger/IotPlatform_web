<template>
        <div class="dashboard-page">
                <h1>欢迎来到仪表盘</h1>
                <p>这里是您的管理面板的概览。</p>
        </div>
        <v-container fluid pa-4>
                <!-- 指标卡片 -->
                <v-row dense>
                        <v-col cols="12" sm="4" md="3" v-for="card in cards" :key="card.title">
                                <v-card elevation="4" class="pa-4">
                                        <v-row align="center">
                                                <v-col cols="auto">
                                                        <v-icon size="36">{{ card.icon }}</v-icon>
                                                </v-col>
                                                <v-col>
                                                        <div class="text-h6">{{ card.value }}</div>
                                                        <div class="text-subtitle-2">{{ card.title }}</div>
                                                </v-col>
                                        </v-row>
                                </v-card>
                        </v-col>
                </v-row>

                <!-- 实时数据图表 -->
                <v-row dense class="mt-4">
                        <v-col cols="12" md="8">
                                <v-card elevation="4" class="pa-4">
                                        <div class="text-h6 mb-2">实时设备数据</div>
                                        <v-echarts :option="lineChartOptions" autoresize style="height: 300px;" />
                                </v-card>
                        </v-col>

                        <!-- 最近上报的数据 -->
                        <v-col cols="12" md="4">
                                <v-card elevation="4" class="pa-4">
                                        <div class="text-h6 mb-2">最新上报</div>
                                        <v-list dense>
                                                <v-list-item v-for="(data, i) in recentData" :key="i">
                                                        <template #title>
                                                                {{ data.device }}
                                                        </template>
                                                        <template #subtitle>
                                                                {{ data.value }}
                                                        </template>
                                                </v-list-item>
                                        </v-list>
                                </v-card>
                        </v-col>
                </v-row>
        </v-container>
</template>


<script lang="ts" setup>

import { ref } from 'vue'
import VCharts from 'vue-echarts'
import * as echarts from 'echarts'
const cards = ref([
        { title: '在线设备', value: 128, icon: 'mdi-router-wireless' },
        { title: '离线设备', value: 12, icon: 'mdi-power-off' },
        { title: '告警数量', value: 8, icon: 'mdi-bell-alert' },
        { title: '总设备数', value: 140, icon: 'mdi-devices' },
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


<style scoped></style>