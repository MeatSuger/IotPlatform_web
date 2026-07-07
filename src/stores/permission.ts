import { defineStore } from 'pinia'
import type { RouteRecordRaw } from 'vue-router'
import router from '@/router'
import { asyncRoutes } from '@/router/routes'

/**
 * 递归过滤路由：根据用户角色过滤 meta.roles 不匹配的路由
 *   - 无 meta.roles → 所有已认证用户可见
 *   - 有 meta.roles → 只有角色交集匹配的用户可见
 */
function filterRoutesByRoles(routes: RouteRecordRaw[], roles: string[]): RouteRecordRaw[] {
  const result: RouteRecordRaw[] = []

  for (const route of routes) {
    const tmp = { ...route }

    // 检查当前路由是否允许访问
    const routeRoles = (tmp.meta?.roles as string[] | undefined) ?? []
    const hasAccess = routeRoles.length === 0 || routeRoles.some((r) => roles.includes(r))

    if (hasAccess) {
      // 递归过滤子路由
      if (tmp.children && tmp.children.length > 0) {
        tmp.children = filterRoutesByRoles(tmp.children, roles)
      }
      result.push(tmp)
    } else {
      // 当前路由无权访问，但子路由可能有权限（例如父路由仅作分组）
      if (tmp.children && tmp.children.length > 0) {
        const filteredChildren = filterRoutesByRoles(tmp.children, roles)
        if (filteredChildren.length > 0) {
          tmp.children = filteredChildren
          result.push(tmp)
        }
      }
    }
  }

  return result
}

/** 把过滤后的路由递归注册到 router */
function addRoutes(routes: RouteRecordRaw[]) {
  routes.forEach((route) => {
    router.addRoute(route)
  })
}

export const usePermissionStore = defineStore('permission', {
  state: () => ({
    routes: [] as RouteRecordRaw[],
    addRouters: [] as RouteRecordRaw[],
    isAddRouters: false,
  }),

  getters: {
    sidebarRoutes: (state) => state.routes,
  },

  actions: {
    /**
     * 根据用户角色生成可访问路由（frontEnd 模式）
     * @param roles 用户角色列表
     */
    generateRoutes(roles: string[]) {
      const accessedRoutes = filterRoutesByRoles(asyncRoutes, roles)

      // 记录并注册
      this.addRouters = accessedRoutes
      this.routes = accessedRoutes
      addRoutes(accessedRoutes)
      this.isAddRouters = true

      return accessedRoutes
    },

    /** 重置路由状态（退出登录时调用） */
    reset() {
      this.addRouters.forEach((route) => {
        if (route.name) {
          router.removeRoute(route.name)
        }
      })
      this.routes = []
      this.addRouters = []
      this.isAddRouters = false
    },
  },
})
