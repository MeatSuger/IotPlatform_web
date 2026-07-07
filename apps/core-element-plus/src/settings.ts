import { setSettings } from '@fantastic-admin/settings'

export default setSettings({
  app: {
    account: {
      auth: true,
    },
    dynamicTitle: true,
    mobile: true,
    home: {
      title: '仪表盘',
      fullPath: '/dashboard',
    },
    copyright: {
      enable: true,
      dates: '2025-2026',
      company: 'IoT Admin',
    },
  },
  theme: {
    colorScheme: '',
  },
  menu: {
    mode: 'single',
  },
  topbar: {
    tabbar: true,
  },
  toolbar: {
    fullscreen: true,
    pageReload: true,
    colorScheme: true,
  },
})
