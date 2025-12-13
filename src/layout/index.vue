<template>
  <div class="app-wrapper">
    <el-container class="shell">
      <el-aside :width="sidebarWidth">
        <SideBar />
      </el-aside>
      <el-container>
        <el-header class="app-header">
          <NavBar />
        </el-header>
        <el-main class="app-main">
          <TagsView />
          <AppMain />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import SideBar from './components/Sidebar/index.vue'
import NavBar from './components/NavBar.vue'
import TagsView from './components/TagsView.vue'
import AppMain from './components/AppMain.vue'

const appStore = useAppStore()
const sidebarWidth = computed(() => (appStore.sidebarCollapsed ? '64px' : '208px'))
</script>

<style scoped>
.app-wrapper {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background-color: #f5f7fa;
}

.shell {
  height: 100%;
}

.app-header {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  box-sizing: border-box;
  border-bottom: 1px solid #ebeef5;
  background: #fff;
}

.app-main {
  padding: 0;
  background: #f5f7fa;
  height: calc(100vh - 56px);
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
