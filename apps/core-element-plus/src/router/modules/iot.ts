import type { RouteRecordMainRaw } from '@fantastic-admin/types'

function Layout() {
  return import('@/layouts/index.vue')
}

const IotRoutes: RouteRecordMainRaw = {
  meta: {
    title: 'IoT 管理',
    icon: 'i-ant-design:cloud-server-outlined',
  },
  children: [
    // 仪表盘
    {
      path: '/dashboard',
      component: Layout,
      name: 'Dashboard',
      meta: {
        title: '仪表盘',
        icon: 'i-ant-design:dashboard-twotone',
      },
      children: [
        {
          path: '',
          name: 'DashboardIndex',
          component: () => import('@/views/iot/dashboard.vue'),
          meta: {
            title: '仪表盘',
            icon: 'i-ant-design:dashboard-twotone',
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
        icon: 'i-ant-design:setting-twotone',
      },
      children: [
        {
          path: 'list',
          name: 'DeviceList',
          component: () => import('@/views/iot/device-list.vue'),
          meta: {
            title: '设备信息',
            icon: 'i-ant-design:unordered-list-outlined',
            keepAlive: true,
          },
        },
        {
          path: 'add',
          name: 'AddDevice',
          component: () => import('@/views/iot/device-add.vue'),
          meta: {
            title: '添加设备',
            icon: 'i-ant-design:plus-circle-outlined',
          },
        },
        {
          path: 'control',
          name: 'DeviceControl',
          component: () => import('@/views/iot/device-control.vue'),
          meta: {
            title: '设备控制',
            icon: 'i-ant-design:control-outlined',
            keepAlive: true,
          },
        }
      ],
    },
    // 数据监控
    {
      path: '/monitor',
      component: Layout,
      name: 'Monitor',
      meta: {
        title: '数据监控',
        icon: 'i-ant-design:line-chart-outlined',
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
