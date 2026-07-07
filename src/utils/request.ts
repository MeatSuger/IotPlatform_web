import axios from 'axios'
import { getToken, removeToken } from '@/utils/auth'

const service = axios.create({
  baseURL: 'http://localhost:9090/api',
  // baseURL: 'https://api.meatsuger.top/api',
  withCredentials: true,
  timeout: 12000,
})

service.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `${token}`
    }
    // 避免浏览器/中间层缓存导致 304 返回空体
    config.headers = config.headers || {}
    config.headers['Cache-Control'] = 'no-cache'
    config.headers.Pragma = 'no-cache'
    return config
  },
  (error) => Promise.reject(error),
)

service.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status
    if (status === 401) {
      // 动态导入避免循环依赖
      const { useUserStore } = await import('@/stores/user')
      const { usePermissionStore } = await import('@/stores/permission')
      const router = (await import('@/router')).default
      const userStore = useUserStore()
      const permissionStore = usePermissionStore()
      removeToken()
      userStore.resetState()
      permissionStore.reset()
      ElMessage.error('登录已过期，请重新登录')
      router.replace({ path: '/auth/login', query: { redirect: router.currentRoute.value.fullPath } })
    } else {
      ElMessage.error(error?.response?.data?.message || '请求失败')
    }
    return Promise.reject(error)
  },
)

export default service
