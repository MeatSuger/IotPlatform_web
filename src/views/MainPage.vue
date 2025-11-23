<template>
        <div class="el-container-prv">
                <el-container class="common-layout">
                        <el-header style="text-align: right; background-color:var(--el-color-primary-dark-2);">
                                <div class="toolbar">
                                        <el-dropdown>
                                                <el-icon style="margin-right: 8px; margin-top: 1px">
                                                        <setting />
                                                </el-icon>
                                                <template #dropdown>
                                                        <el-dropdown-menu>
                                                                <el-dropdown-item>我的</el-dropdown-item>
                                                                <el-dropdown-item>登出</el-dropdown-item>
                                                        </el-dropdown-menu>
                                                </template>
                                        </el-dropdown>
                                        <span>Tom</span>
                                </div>
                        </el-header>
                        <!-- 主体容器自身承接滚动 -->
                        <el-container class="body-container">
                                <el-aside width="150px">
                                        <el-scrollbar class="aside-scrol">
                                                <el-menu :default-openeds="['1']" :router="true">
                                                        <template v-for="(item, i) in items" :key="i">
                                                                <!-- 有子菜单：使用 sub-menu -->
                                                                <el-sub-menu
                                                                        v-if="item.chindern && item.chindern.length"
                                                                        :index="String(i + 1)">
                                                                        <template #title>
                                                                                <el-icon>
                                                                                        <message />
                                                                                </el-icon>{{ item.title }}
                                                                        </template>
                                                                        <el-menu-item
                                                                                v-for="(child, j) in item.chindern"
                                                                                :key="j" :index="child.routeName"
                                                                                :route="{ name: child.routeName }">
                                                                                {{ child.title }}
                                                                        </el-menu-item>
                                                                </el-sub-menu>

                                                                <!-- 无子菜单但有 path：渲染为可路由的 menu-item -->
                                                                <el-menu-item v-else-if="item.routeName"
                                                                        :index="item.routeName"
                                                                        :route="{ name: item.routeName }">
                                                                        <el-icon>
                                                                                <message />
                                                                        </el-icon>
                                                                        <span>{{ item.title }}</span>
                                                                </el-menu-item>
                                                                <!-- 其他情况：不渲染或可放占位 -->
                                                        </template>
                                                </el-menu>
                                        </el-scrollbar>
                                </el-aside>
                                <el-container style="background-color: aqua;">
                                        <el-main class="main-scroll">
                                                <RouterView />
                                        </el-main>
                                </el-container>
                        </el-container>
                </el-container>
        </div>
</template>

<script setup lang="ts" name="MainPage">
import { Menu as Message, Setting } from '@element-plus/icons-vue'


const items = [
        { title: '仪表盘', icon: 'Odomete', name: 'dashboard', routeName: 'dashboard' },
        {
                title: '设备管理', icon: 'mdi-router-wireless', name: 'devices', chindern: [
                        { title: '设备信息', routeName: 'deviceInfo' },
                        { title: '添加设备', routeName: 'addDevice' },
                ]
        },
        { title: '数据监控', icon: 'mdi-chart-line', name: 'monitor', routeName: 'monitor' },
        { title: '告警日志', icon: 'mdi-bell-alert', name: 'alerts' },
        { title: '系统设置', icon: 'mdi-cog', name: 'settings' },
]
</script>

<style scoped>
.el-container-prv {
        position: fixed;
        /* ✅ 铺满视口 */
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: flex-end;
}

.common-layout {
        height: 100%;
        overflow: hidden;
}

.body-container {
        min-height: 0;
        /* 关键：允许子项按容器收缩，避免被内容撑开 */
        overflow: hidden;
}

.aside-scroll {
        height: 100%;
}

.main-scroll {
        height: 100%;
        overflow: auto;
        /* 内容在这里滚动 */
}
</style>
