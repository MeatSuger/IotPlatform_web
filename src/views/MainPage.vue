<template>
        <v-app theme="dark">
                <!-- 侧边导航抽屉 -->
                <v-navigation-drawer :width="160" elevation="2" permanent expand-on-hover rail>
                        <v-list nav dense lines="one" density="compact">
                                <v-list-item v-for="(item, i) in items" :to=item.name :key="i">
                                        <template #prepend>
                                                <v-icon>{{ item.icon }}</v-icon>
                                        </template>
                                        <template #title>
                                                {{ item.title }}
                                        </template>
                                </v-list-item>
                        </v-list>
                </v-navigation-drawer>


                <!-- 主内容区域 -->
                <v-main>
                        <v-container fluid pa-4>
                                <RouterView />
                        </v-container>
                </v-main>
        </v-app>
</template>

<script setup lang="ts" name="MainPage">
import { StyleProvider, Themes } from '@varlet/ui';
StyleProvider(Themes.md3Dark)

const items = [
        { title: '仪表盘', icon: 'mdi-view-dashboard', name: 'dashboard' },
        { title: '设备管理', icon: 'mdi-router-wireless', name: 'devices' },
        { title: '数据监控', icon: 'mdi-chart-line', name: 'monitor' },
        { title: '告警日志', icon: 'mdi-bell-alert', name: 'alerts' },
        { title: '系统设置', icon: 'mdi-cog', name: 'settings' },
]
</script>

<style scoped></style>
