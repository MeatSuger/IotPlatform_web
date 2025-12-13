<template>
  <el-sub-menu v-if="hasChildren" :index="resolvedPath">
    <template #title>
      <component v-if="IconComp" :is="IconComp" class="menu-icon" />
      <span>{{ item.meta?.title }}</span>
    </template>

    <SidebarItem v-for="child in visibleChildren" :key="child.path" :item="child" :base-path="resolvedPath" />
  </el-sub-menu>

  <el-menu-item v-else :index="resolvedPath">
    <component v-if="IconComp" :is="IconComp" class="menu-icon" />
    <span>{{ item.meta?.title }}</span>
  </el-menu-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import * as ElIcons from '@element-plus/icons-vue'

interface Props {
  item: RouteRecordRaw
  basePath?: string
}

const props = defineProps<Props>()

const visibleChildren = computed(() =>
  (props.item.children || []).filter(
    (child: any) => !child.meta?.hidden
  )
)

const hasChildren = computed(() => visibleChildren.value.length > 0)

const resolvedPath = computed(() => {
  const base = props.basePath || ''
  const path = props.item.path || ''
  if (path.startsWith('/')) return path
  return `${base}/${path}`.replace(/\/+/g, '/')
})

const IconComp = computed(() => {
  const iconName = props.item.meta?.icon as string | undefined
  return iconName && (ElIcons as any)[iconName]
    ? (ElIcons as any)[iconName]
    : null
})
</script>

<style scoped>
.menu-icon {
  margin-right: 8px;
  width: 16px;
  height: 16px;
}
</style>
