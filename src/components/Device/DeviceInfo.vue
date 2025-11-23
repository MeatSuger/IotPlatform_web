<template>
        <el-card>
                <template #header>
                        <el-form :model="query" :inline="true" class="demo-form-inline">
                                <el-form-item label="">
                                        <el-button type="primary" @click="loadColumns">load columns</el-button>
                                </el-form-item>
                                <el-form-item label="date range">
                                        <el-date-picker v-model="value1" type="datetimerange" range-separator="To"
                                                start-placeholder="Start date" end-placeholder="End date"
                                                :shortcuts="shortcuts" />
                                </el-form-item>
                                <el-form-item label="device name">
                                        <el-input v-model="query.devicename" placeholder="" clearable />
                                </el-form-item>
                                <el-form-item label="">
                                        <el-button type="primary" @click="">query</el-button>
                                </el-form-item>
                                <el-form-item label="">
                                        <el-button type="text">导出</el-button>
                                </el-form-item>

                        </el-form>

                </template>


                <div>
                        <el-table :data="tableData" border stripe height="500px"
                                :default-sort="{ prop: 'id', order: 'descending' }">
                                <el-table-column v-for="col in dynamicCols" :key="col" :prop="col" :label="col"
                                        show-overflow-tooltip>
                                        <template #default="{ row }">
                                                <!-- 当列名为 id 或 deviceId（不区分大小写）时，渲染为可点击链接，携带 deviceId 到分析页 -->
                                                <template v-if="['deviceid'].includes(String(col).toLowerCase())">
                                                        <router-link :to="{ name: 'monitor', query: { deviceId: row[col] } }">
                                                                {{ row[col] ?? '' }}
                                                        </router-link>
                                                </template>
                                                <template v-else>
                                                        {{ row[col] ?? '' }}
                                                </template>
                                        </template>
                                </el-table-column> 
                        </el-table>
                        <div class="pagination-wrap">
                                <el-pagination layout="prev, pager, next" :total="50" />
                        </div>
                </div>
        </el-card>

</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const value1 = ref('')
const query = reactive({
        devicename: '',
        daterange: ''
})
// 动态列（从 API 获取列定义，不修改数据）
type ColDef = { prop: string; label: string; width?: number }
const dynamicCols = ref<string[]>([])
const tableData = ref<any[]>([])
onMounted(() => {
        axios.defaults.headers.common['Authorization'] = `${localStorage.getItem('token')}`
        console.log(axios.defaults.headers.common['Authorization']);
        loadColumns()
})
async function loadColumns() {
        try {

                const { data } = await axios.get('/device/list');
                // data.data 是设备列表
                tableData.value = Array.isArray(data.data) ? data.data : []
                // 用第一个对象的所有 key 作为列名
                if (tableData.value.length > 0) {
                        dynamicCols.value = Object.keys(tableData.value[0])
                } else {
                        dynamicCols.value = []
                }
        } catch (e: unknown) {
                console.error('load columns failed', e)
                const msg = e instanceof Error ? e.message : String(e)
                ElMessage.error(msg)
                dynamicCols.value = []
                tableData.value = []

        }
}
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

                }
        }];
</script>
<style scoped></style>