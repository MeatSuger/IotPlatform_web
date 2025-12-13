import { defineStore } from 'pinia'
import type { RouteRecordRaw } from 'vue-router'

function hasChildren(route: RouteRecordRaw) {
  return Array.isArray(route.children) && route.children.length > 0
}

export const usePermissionStore = defineStore('permission', {
  state: () => ({
    routes: [] as RouteRecordRaw[],
    isInit: false,
  }),
  getters: {
    sidebarRoutes: (state) => state.routes,
  },
  actions: {
    async generateRoutes(asyncRoutes: RouteRecordRaw[]) {
      // 仅保留带组件的路由（去除通配符 404 重定向等不可展示项）
      const filtered = asyncRoutes.filter((r) => (r as any).component)
      this.routes = filtered
      return filtered
    },
    markInited() {
      this.isInit = true
    },
    reset() {
      this.routes = []
      this.isInit = false
    },
  },
})
