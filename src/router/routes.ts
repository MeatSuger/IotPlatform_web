import type { RouteRecordRaw } from 'vue-router'
import Layout from '@/layout/index.vue'

export const constantRoutes: RouteRecordRaw[] = [
  {
    path: '/auth',
    redirect: '/auth/login',
    component: () => import('@/views/LoginPage.vue'),
    meta: { public: true },
    children: [
      {
        path: 'login',
        name: 'Login',
        component: () => import('@/layout/components/Login.vue'),
        meta: { title: '登录', public: true },
      },
      {
        path: 'resinger',
        name: 'Resinger',
        component: () => import('@/layout/components/Resinger.vue'),
        meta: { title: '注册', public: true },
      },
    ],
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/error/NotFound.vue'),
    meta: { title: '404', public: true },
  },
  // 404 兜底应作为常量路由，确保异步路由未注册前也可正常跳转
  { path: '/:pathMatch(.*)*', redirect: '/404', meta: { public: true } },
]

export const asyncRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Layout,
    redirect: 'dashboard',
    meta: { title: '首页', icon: 'House' },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/layout/components/Dashboard.vue'),
        meta: { title: '仪表盘', icon: 'Odometer', affix: true },
      },
      {
        path: 'devices',
        name: 'Devices',
        redirect: '/devices/list',
        component: () => import('@/layout/RouteView.vue'),
        meta: { title: '设备管理', icon: 'Cpu' },
        children: [
          {
            path: 'list',
            name: 'DeviceInfo',
            component: () => import('@/layout/components/Device/DeviceInfo.vue'),
            meta: { title: '设备信息', icon: 'List' },
          },
          {
            path: 'add',
            name: 'AddDevice',
            component: () => import('@/layout/components/Device/AddDevice.vue'),
            meta: { title: '添加设备', icon: 'Plus' },
          },
        ],
      },
      {
        path: 'monitor',
        name: 'Monitor',
        component: () => import('@/layout/components/Analysis/Analysis.vue'),
        meta: { title: '数据监控', icon: 'DataBoard' },
      },
    ],
  },
]
