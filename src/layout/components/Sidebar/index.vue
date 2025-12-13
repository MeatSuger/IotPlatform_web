<template>
  <div class="sidebar">
    <div class="logo" @click="goHome">
      <span class="logo-text">IoT Admin</span>
    </div>
    <el-scrollbar height="calc(100vh - 56px)">
      <el-menu :default-active="activeMenu" :collapse="appStore.sidebarCollapsed" router
        class="el-menu-vertical" background-color="#001529" text-color="#bfcbd9" active-text-color="#ffd04b"
       >
        <SidebarItem v-for="route in menuRoutes" :key="route.path" :item="route" />
      </el-menu>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePermissionStore } from '@/stores/permission'
import { useAppStore } from '@/stores/app'
import SidebarItem from './SidebarItem.vue'

const route = useRoute()
const router = useRouter()
const permissionStore = usePermissionStore()
const appStore = useAppStore()

const activeMenu = computed(() => route.path)
const menuRoutes = computed(() => permissionStore.sidebarRoutes || [])

const goHome = () => {
  router.push('/dashboard')
}
</script>

<style scoped>
.sidebar {
  height: 100%;
  background: #001529;
  color: #fff;
  display: flex;
  flex-direction: column;
}

.logo {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  cursor: pointer;
  font-weight: 700;
  color: #fff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.logo-text {
  white-space: nowrap;
}

.el-menu-vertical {
  border-right: none;
}
</style>
