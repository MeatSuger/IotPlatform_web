import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { constantRoutes, asyncRoutes } from './routes'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: constantRoutes as RouteRecordRaw[],
})

const whiteList = ['/auth/login', '/auth/resinger']

router.beforeEach(async (to, _from, next) => {
  const userStore = useUserStore()
  const permissionStore = usePermissionStore()
  const hasToken = !!userStore.token

  if (hasToken) {
    if (to.path.startsWith('/auth')) {
      return next({ path: '/' })
    }
    if (!permissionStore.isInit) {
      const accessRoutes = await permissionStore.generateRoutes(asyncRoutes)
      accessRoutes.forEach((route) => {
        router.addRoute(route)
      })
      permissionStore.markInited()
      return next({ ...to, replace: true })
    }
    return next()
  }

  if (whiteList.includes(to.path) || to.meta.public) {
    return next()
  }
  next({ path: '/auth/login', query: { redirect: to.fullPath } })
})

router.listening = true

// 调试：输出每次导航的目标
router.afterEach((to) => {
  // eslint-disable-next-line no-console
  console.info('[router.afterEach] navigate to:', to.fullPath)
})

export default router
