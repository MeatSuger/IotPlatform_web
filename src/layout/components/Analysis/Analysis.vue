<template>
    <el-card>
        <template #header>
            <el-form :model="query" :inline="true" class="demo-form-inline">
                <el-form-item label="date range">
                    <el-date-picker v-model="value1" type="datetimerange" range-separator="To"
                        start-placeholder="Start date" end-placeholder="End date" :shortcuts="shortcuts" />
                </el-form-item>
                <el-form-item label="device id">
                    <el-input v-model="query.deviceId" placeholder="设备ID" clearable />
                </el-form-item>
                <el-form-item label="keyword">
                    <el-input v-model="query.keyword" placeholder="" clearable />
                </el-form-item>

                <el-form-item label="">
                    <el-button type="primary" :loading="loading" @click="onQuery()">query</el-button>
                </el-form-item>
                <el-form-item label="">
                    <el-button type="text">导出</el-button>
                </el-form-item>
            </el-form>
        </template>
        <div>
            <!-- 折线图：展示监控指标趋势，与设备信息页风格一致 -->
            <v-chart class="chart" :option="chartOption" autoresize />

            <el-table :data="tablePageData" border stripe max-height="450px" :loading="loading" class="equal-cols">
                <el-table-column prop="timestamp" label="Time" show-overflow-tooltip align="center" />
                <el-table-column prop="name" label="Name" show-overflow-tooltip align="center" />
                <el-table-column prop="type" label="Type" show-overflow-tooltip align="center" />
                <el-table-column prop="value" label="Value" show-overflow-tooltip align="center" />
            </el-table>
            <div class="pagination-wrap">
                <el-pagination layout="prev, pager, next, sizes, total" :total="tableTotal" :current-page="currentPage"
                    :page-size="pageSize" :page-sizes="[10, 20, 50, 100]" @current-change="onPageChange"
                    @size-change="onPageSizeChange" />
            </div>
        </div>
    </el-card>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, onBeforeRouteUpdate } from 'vue-router'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent])

const value1 = ref('')
const shortcuts = [
    {
        text: 'Last 24 Hours',
        value: () => {
            const end = new Date()
            const start = new Date()
            start.setDate(start.getDate() - 1)
            return [start, end]
        },
    },
    {
        text: 'Last week',
        value: () => {
            const end = new Date()
            const start = new Date()
            start.setDate(start.getDate() - 7)
            return [start, end]
        },
    },
    {
        text: 'Last month',
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

// 从路由 query 中自动吸收 deviceId（支持用户直接访问带参数的链接）
const route = useRoute()
function syncDeviceIdFromRoute() {
    const rid = route.query.deviceId
    if (typeof rid === 'string' && rid && rid !== query.deviceId) {
        query.deviceId = rid
        // 自动触发一次查询
        onQuery()
    }
}
// 首次加载时同步
syncDeviceIdFromRoute()
// 监听路由变化（例如从设备列表点击跳转）
watch(() => route.query.deviceId, () => {
    syncDeviceIdFromRoute()
})
// 每次路由更新（含参数变更）时刷新数据（有 deviceId 时）
onBeforeRouteUpdate((to, _from, next) => {
    if (query.deviceId) {
        console.info('[Analysis] beforeRouteUpdate -> refresh')
        onQuery(true)
    }
    next()
})

// 原始数据与分页相关状态
const rawData = ref<Array<Record<string, any>>>([])
const tableTotal = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const loading = ref(false)

// 最简单方式在前端附带“类似 cookie”的凭证：直接加 Authorization 头
// 注意：浏览器不允许前端直接设置 Cookie 请求头；要发送真正 Cookie 需后端通过 Set-Cookie 设置，且域名一致。
// const authToken = ref(localStorage.getItem('Authorization') || '')
// function applyToken() {
//     if (authToken.value) {
//         localStorage.setItem('Authorization', authToken.value)
//         axios.defaults.headers.common['Authorization'] = authToken.value
//     } else {
//         localStorage.removeItem('Authorization')
//         delete axios.defaults.headers.common['Authorization']
//     }
// }
// // 应用已保存的 token（页面加载时）
// applyToken()


// 直接使用后端数据结构（name/type/value/timestamp），不过滤/复制一遍
const filteredData = computed(() => {
    const kw = query.keyword?.trim()?.toLowerCase()
    if (!kw) return rawData.value
    return rawData.value.filter((d: any) =>
        String(d.name ?? '').toLowerCase().includes(kw) ||
        String(d.type ?? '').toLowerCase().includes(kw) ||
        String(d.value ?? '').toLowerCase().includes(kw) ||
        String(d.timestamp ?? d.time ?? d.date ?? '').toLowerCase().includes(kw)
    )
})

const tablePageData = computed(() => {
    tableTotal.value = filteredData.value.length
    const start = (currentPage.value - 1) * pageSize.value
    return filteredData.value.slice(start, start + pageSize.value)
})

function toNumber(v: unknown): number {
    const num = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''))
    return Number.isNaN(num) ? 0 : num
}

// 生成多序列折线图：按 type（无则用 name）分组
function parseDateSafe(s: string) {
    const t = Date.parse(s)
    return Number.isNaN(t) ? 0 : t
}

const timeAxis = computed(() => {
    const xs = Array.from(
        new Set(filteredData.value.map((d: any) => d.timestamp ?? d.time ?? d.date ?? ''))
    ) as string[]
    return xs.sort((a, b) => parseDateSafe(a) - parseDateSafe(b))
})

const seriesKeys = computed(() =>
    Array.from(new Set(filteredData.value.map((d: any) => d.type || d.name || 'value')))
)

const chartOption = computed(() => {
    const xData = timeAxis.value
    const keys = seriesKeys.value
    const series = keys.map((key) => ({
        name: key,
        type: 'line' as const,
        smooth: true,
        data: xData.map((t) => {
            const hit = filteredData.value.find(
                (d: any) => (d.type || d.name) === key && (d.timestamp ?? d.time ?? d.date ?? '') === t
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

async function onQuery(silent = false) {
    if (!query.deviceId) return
    loading.value = true
    try {
        // 使用 axios 全局 baseURL 和 withCredentials，从 Cookie 携带 Authorization
        const { data } = await request.get(`/data/${encodeURIComponent(query.deviceId)}/Data/list`, {
            params: { limit: Math.max(pageSize.value * 2, 20) }, // 一次取更多，前端分页
            // 额外兜底：如果全局未设置默认 Authorization，则本次请求携带（最简方式）
        })
        if (data.data == null && !silent) {
            ElMessage.info(`服务器返回：${data?.message ?? '无数据'}`)
        }

        // 兼容不同返回结构：如果 data.data 是数组就用它，否则尝试 data.list 或 data 本身
        const list = Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.list)
                ? data.list
                : Array.isArray(data)
                    ? data
                    : []
        rawData.value = list
        currentPage.value = 1
        console.info(`[Analysis] data loaded: ${list.length} items`)
        if (!silent) {
            ElMessage.success(`获取数据成功，共 ${list.length} 条`)
        }
    } catch (e) {
        // 这里不暴露具体错误细节，保持最小提示
        console.error('fetch analysis data failed', e)
        if (!silent) {
            ElMessage.error('获取数据失败，请稍后重试')
        }
    } finally {
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

// 初次加载 + 5 秒自动刷新（避免并发：loading 时跳过）
onMounted(() => {
    // 若没有通过路由带 deviceId，则尝试初次查询（可能为空，不触发请求）
    if (query.deviceId) {
        onQuery()
    }
    const timer = window.setInterval(() => {
        if (!loading.value) {
            onQuery(true)
        }
    }, 5000)
    // 清理定时器
    onBeforeUnmount(() => {
        clearInterval(timer)
    })
})
</script>

<style scoped>
.pagination-wrap {
    width: 100%;
    display: flex;
    justify-content: flex-end;
    padding: 8px 0;
    box-sizing: border-box;
}

.chart {
    width: 100%;
    height: 280px;
    margin-bottom: 12px;
}

/* 表格列均匀分布：固定表格布局，并移除列宽以平均分配 */
.equal-cols :deep(.el-table__header-wrapper table),
.equal-cols :deep(.el-table__body-wrapper table) {
    table-layout: fixed;
    width: 100%;
}
</style>
