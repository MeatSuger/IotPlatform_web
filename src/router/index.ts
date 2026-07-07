import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { constantRoutes } from './routes'
import { useUserStore } from '@/stores/user'
import { usePermissionStore } from '@/stores/permission'
import { getToken } from '@/utils/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: constantRoutes as RouteRecordRaw[],
})

/** 无需登录即可访问的路径 */
const whiteList = ['/auth/login', '/auth/resinger']

router.beforeEach(async (to, _from, next) => {
  const userStore = useUserStore()
  const permissionStore = usePermissionStore()
  const hasToken = !!getToken()

  if (hasToken) {
    // 已登录用户访问登录/注册页 → 重定向到首页
    if (to.path.startsWith('/auth')) {
      return next({ path: '/' })
    }

    // 已有用户信息 → 直接放行
    if (userStore.hasUserInfo) {
      return next()
    }

    // 有 token 但无用户信息 → 调用 /isLogin 获取用户信息并生成动态路由
    try {
      await userStore.getUserInfo()
      const roles = userStore.roles
      await permissionStore.generateRoutes(roles)
      return next({ ...to, replace: true })
    } catch (error) {
      // 获取用户信息失败（token 过期等） → 清除 token 并跳转登录页
      console.error('[router.beforeEach] 获取用户信息失败', error)
      userStore.resetState()
      permissionStore.reset()
      return next({ path: '/auth/login', query: { redirect: to.fullPath } })
    }
  }

  // 未登录：白名单放行，其他重定向到登录页
  if (whiteList.includes(to.path) || to.meta.public) {
    return next()
  }
  next({ path: '/auth/login', query: { redirect: to.fullPath } })
})

router.afterEach((to) => {
  console.info('[router.afterEach] navigate to:', to.fullPath)
})

export default router
