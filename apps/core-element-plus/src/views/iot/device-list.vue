<script setup lang="ts">
import { onBeforeUnmount, onErrorCaptured, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteUpdate } from 'vue-router'
import { deviceApi } from '@/api/modules/iot/device'

defineOptions({ name: 'DeviceList' })

const dateRange = ref('')
const query = reactive({
  devicename: '',
  daterange: '',
})

const dynamicCols = ref<string[]>([])
const tableData = ref<any[]>([])

onMounted(() => {
  loadColumns()
})

onBeforeRouteUpdate((_to, _from, next) => {
  loadColumns()
  next()
})

onBeforeUnmount(() => {
  console.warn('[DeviceList] component is being unmounted')
})

onErrorCaptured((err) => {
  console.error('[DeviceList] render error:', err)
  return false
})

async function loadColumns() {
  try {
    const res = await deviceApi.list()
    const list = Array.isArray(res?.data?.data)
      ? res.data.data
      : Array.isArray(res?.data)
        ? res.data
        : []
    tableData.value = list
    dynamicCols.value = list.length > 0 ? Object.keys(list[0]) : []
  }
  catch (e: unknown) {
    console.error('[DeviceList] load failed', e)
    const msg = e instanceof Error ? e.message : String(e)
    useFaToast().error('加载失败', { description: msg })
    dynamicCols.value = []
    tableData.value = []
  }
}

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
</script>

<template>
  <FaPageMain>
    <el-card>
      <template #header>
        <el-form :model="query" :inline="true">
          <el-form-item label="">
            <el-button type="primary" @click="loadColumns">
              加载列表
            </el-button>
          </el-form-item>
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
          <el-form-item label="设备名称">
            <el-input v-model="query.devicename" placeholder="" clearable />
          </el-form-item>
          <el-form-item label="">
            <el-button type="primary" @click="loadColumns">
              查询
            </el-button>
          </el-form-item>
          <el-form-item label="">
            <el-button type="text">
              导出
            </el-button>
          </el-form-item>
        </el-form>
      </template>

      <div>
        <el-table
          :data="tableData"

          stripe border
          max-height="500px"
          :default-sort="{ prop: 'id', order: 'descending' }"
        >
          <el-table-column
            v-for="col in dynamicCols"
            :key="col"
            :prop="col"
            :label="col"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <template v-if="['deviceid'].includes(String(col).toLowerCase())">
                <router-link :to="{ name: 'MonitorIndex', query: { deviceId: row[col] } }">
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
</style>
