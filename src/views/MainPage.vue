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
                                                                <el-dropdown-item>View</el-dropdown-item>
                                                                <el-dropdown-item>Add</el-dropdown-item>
                                                                <el-dropdown-item>Delete</el-dropdown-item>
                                                        </el-dropdown-menu>
                                                </template>
                                        </el-dropdown>
                                        <span>Tom</span>
                                </div>
                        </el-header>
                        <el-container>
                                <el-aside width="150px">
                                        <el-scrollbar class="aside-scroll">
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
                                        <el-main>
                                                <RouterView />
                                        </el-main>
                                </el-container>
                        </el-container>
                </el-container>
        </div>
</template>

<script setup lang="ts" name="MainPage">
import { StyleProvider, Themes } from '@varlet/ui';
import { Menu as IconMenu, Message, Setting } from '@element-plus/icons-vue'

StyleProvider(Themes.md3Dark)

const items = [
        { title: '仪表盘', icon: 'mdi-view-dashboard', name: 'dashboard', routeName: 'dashboard' },
        {
                title: '设备管理', icon: 'mdi-router-wireless', name: 'devices', chindern: [
                        { title: '设备信息', routeName: 'deviceInfo' },
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
        /* ✅ 确保铺满整个视口 */
        top: 0;
        left: 0;
        min-width: 100%;
        min-height: 100%;
        display: flex;
        justify-content: flex-end;

}


.aside-spacer {
        flex: 1 1 auto;
        min-height: 0;
}
</style>
