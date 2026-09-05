import type { RouteRecordMainRaw } from '@fantastic-admin/types'

function Layout() {
  return import('@/layouts/index.vue')
}

const IotRoutes: RouteRecordMainRaw = {
  meta: {
    title: 'IoT 管理',
    icon: 'i-ri:cloud-line',
  },
  children: [
    // 仪表盘
    {
      path: '/dashboard',
      component: Layout,
      name: 'Dashboard',
      meta: {
        title: '仪表盘',
        icon: 'i-ri:dashboard-line',
      },
      children: [
        {
          path: '',
          name: 'DashboardIndex',
          component: () => import('@/views/iot/dashboard.vue'),
          meta: {
            title: '仪表盘',
            icon: 'i-ri:dashboard-line',
            affix: true,
            keepAlive: true,
            menu: false,
            breadcrumb: false,
          },
        },
      ],
    },
    // 设备管理
    {
      path: '/devices',
      component: Layout,
      name: 'Devices',
      redirect: '/devices/list',
      meta: {
        title: '设备管理',
        icon: 'i-ri:settings-line',
      },
      children: [
        {
          path: 'list',
          name: 'DeviceList',
          component: () => import('@/views/iot/device-list.vue'),
          meta: {
            title: '设备信息',
            icon: 'i-ri:list-unordered',
            keepAlive: true,
          },
        },
        {
          path: 'add',
          name: 'AddDevice',
          component: () => import('@/views/iot/device-add.vue'),
          meta: {
            title: '添加设备',
            icon: 'i-ri:add-circle-line',
          },
        },
        {
          path: 'log',
          name: 'LogDevice',
          component: () => import('@/views/iot/device-log.vue'),
          meta: {
            title: '设备日志',
            menu: false,
            activeMenu: '/devices/list',
            noKeepAlive: 'DeviceList',
          },
        },
        {
          path: 'control',
          name: 'DeviceControl',
          component: () => import('@/views/iot/device-control.vue'),
          meta: {
            title: '设备控制',
            icon: 'i-ri:gamepad-line',
            keepAlive: true,
          },
        },
      ],
    },
    // 数据监控
    {
      path: '/monitor',
      component: Layout,
      name: 'Monitor',
      meta: {
        title: '数据监控',
        icon: 'i-ri:line-chart-line',
      },
      children: [
        {
          path: '',
          name: 'MonitorIndex',
          component: () => import('@/views/iot/monitor.vue'),
          meta: {
            title: '数据监控',
            keepAlive: true,
            menu: false,
            breadcrumb: false,
          },
        },
      ],
    },
  ],
}

export default IotRoutes
