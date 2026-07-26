<script setup lang="ts">
import { useElementSize, useWindowSize } from '@vueuse/core'
import { computed, h, onBeforeUnmount, onErrorCaptured, onMounted, reactive, ref, useTemplateRef } from 'vue'
import { onBeforeRouteUpdate, RouterLink } from 'vue-router'
import { deviceApi } from '@/api/modules/iot/device'

defineOptions({ name: 'DeviceList' })

const dateRange = ref('')
const query = reactive({
  devicename: '',
  daterange: '',
})

const tableData = ref<any[]>([])

// 动态列定义 — 使用 cell 渲染函数避免动态 slot 类型问题
const columns = ref<any[]>([])

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

const timeFieldPattern = /time|date|at$/

function buildColumns(data: any[]) {
  if (data.length === 0) {
    columns.value = []
    return
  }
  columns.value = Object.keys(data[0]).map((col) => {
    const colItem: any = {
      accessorKey: col,
      header: col,
    }
    // 时间字段：用 cell 渲染格式化
    if (timeFieldPattern.test(col.toLowerCase())) {
      colItem.cell = ({ getValue }: { getValue: () => any }) => formatTime(getValue())
    }
    // deviceId 字段：渲染为链接
    if (col.toLowerCase() === 'deviceid') {
      colItem.cell = ({ getValue }: { getValue: () => any }) => {
        const v = getValue()
        return h(RouterLink, {
          to: { name: 'MonitorIndex', query: { deviceId: v } },
          class: 'text-primary cursor-pointer hover:underline',
        }, () => v ?? '')
      }
    }
    return colItem
  })
}

// 自适应表格最大高度
const { height: windowHeight } = useWindowSize()
const headerCardRef = useTemplateRef('headerCardRef')
const { height: cardHeaderHeight } = useElementSize(headerCardRef)
const tableMaxHeight = computed(() => {
  const overhead = 32 + 32 + 50 + 40 + 200 + (cardHeaderHeight.value || 60)
  return Math.max(150, windowHeight.value - overhead)
})

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
    buildColumns(list)
  }
  catch (e: unknown) {
    console.error('[DeviceList] load failed', e)
    const msg = e instanceof Error ? e.message : String(e)
    useFaToast().error('加载失败', { description: msg })
    tableData.value = []
    columns.value = []
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
  <FaPageMain class="!m-0 border-0! rounded-none! h-full! overflow-hidden!">
    <FaCard class="flex flex-col h-full overflow-hidden">
      <template #header>
        <div ref="headerCardRef" class="flex flex-wrap gap-3 items-center">
          <FaButton variant="default" size="sm" @click="loadColumns">
            加载列表
          </FaButton>
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            :shortcuts="shortcuts"
          />
          <FaInput v-model="query.devicename" placeholder="设备名称" class="!w-200px" />
          <FaButton variant="default" size="sm" @click="loadColumns">
            查询
          </FaButton>
          <FaButton variant="ghost" size="sm">
            导出
          </FaButton>
        </div>
      </template>

      <div class="flex flex-1 flex-col min-h-0">
        <div class="table-wrapper flex-1 min-h-0" :style="{ maxHeight: `${tableMaxHeight}px` }">
          <FaTable
            :columns="columns"
            :data="tableData"
            stripe
            border
          />
        </div>
        <div class="pagination-wrap shrink-0">
          <FaPagination :page="1" :size="10" :total="50" />
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

.table-wrapper {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
