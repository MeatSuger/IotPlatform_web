<template>
  <div class="navbar">
    <div class="left">
      <el-button link type="primary" @click="toggle">
        <el-icon><Fold v-if="!appStore.sidebarCollapsed" /><Expand v-else /></el-icon>
      </el-button>
      <el-breadcrumb separator="/">
        <el-breadcrumb-item v-for="item in breadcrumb" :key="item.path">
          <router-link :to="item.path">{{ item.meta?.title }}</router-link>
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>
    <div class="right">
      <el-dropdown>
        <span class="user-entry">
          <el-icon><User /></el-icon>
          <span class="user-name">{{ username }}</span>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="onLogout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'
import { Fold, Expand, User } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const permissionStore = usePermissionStore()

const breadcrumb = computed(() => route.matched.filter((r) => r.meta?.title))
const username = computed(() => userStore.loginData.account || '用户')

const toggle = () => {
  appStore.toggleSidebar()
}

const onLogout = () => {
  userStore.logout()
  permissionStore.reset()
  router.replace('/auth/login')
}
</script>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-entry {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #303133;
}

.user-name {
  font-weight: 600;
}
</style>
