import axios from 'axios'

// 请求重试配置
const MAX_RETRY_COUNT = 3
const RETRY_DELAY = 1000

// 扩展 AxiosRequestConfig 类型
declare module 'axios' {
  export interface AxiosRequestConfig {
    retry?: boolean
    retryCount?: number
    fake?: boolean
  }
}

/**
 * 获取 baseURL
 * - 开发模式 + 启用代理 → /proxy/
 * - 其他情况 → 使用环境变量
 */
function getBaseURL(dataApi = false): string {
  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_PROXY) {
    return '/proxy/'
  }
  // 数据查询 API 走 Worker 相对路径（仅在设置了 VITE_DATA_API_BASEURL 时）
  if (dataApi && import.meta.env.VITE_DATA_API_BASEURL) {
    return import.meta.env.VITE_DATA_API_BASEURL
  }
  return import.meta.env.VITE_APP_API_BASEURL
}

/**
 * 创建 axios 实例的工厂函数
 */
function createApi(baseURL: string) {
  const instance = axios.create({
    baseURL,
    timeout: 1000 * 60,
    responseType: 'json',
    withCredentials: true,
  })

  instance.interceptors.request.use((request) => {
    const appAccountStore = useAppAccountStore()
    if (request.headers) {
      request.headers['Accept-Language'] = 'zh-CN'
      if (appAccountStore.isLogin) {
        request.headers.Authorization = appAccountStore.token
      }
    }
    return request
  })

  return instance
}

// 处理错误信息的函数
function handleError(error: any) {
  if (error.status === 401) {
    useAppAccountStore().requestLogout()
  }
  else {
    useFaToast().error('Error', {
      description: error.message,
    })
  }
  return Promise.reject(error)
}

/**
 * 为实例添加响应拦截器（共享逻辑）
 */
function addResponseInterceptor(instance: ReturnType<typeof axios.create>) {
  instance.interceptors.response.use(
    (response) => {
      const res = response.data
      if (typeof res === 'object' && res !== null) {
        if ('code' in res) {
          if (res.code === 200) {
            return Promise.resolve(res)
          }
          else if (res.code === 401) {
            useAppAccountStore().requestLogout()
            return Promise.reject(res)
          }
          else {
            useFaToast().error('Error', {
              description: res.message || '请求失败',
            })
            return Promise.reject(res)
          }
        }
        if (res.status === 1) {
          if (res.error) {
            useFaToast().warning('Warning', {
              description: res.error,
            })
            return Promise.reject(res)
          }
          return Promise.resolve(res.data)
        }
        else if (res.status === 0) {
          useAppAccountStore().requestLogout()
          return Promise.reject(res)
        }
        return Promise.resolve(res)
      }
      return Promise.reject(res)
    },
    async (error) => {
      const config = error.config
      if (!config || !config.retry) {
        return handleError(error)
      }
      config.retryCount = config.retryCount || 0
      if (config.retryCount >= MAX_RETRY_COUNT) {
        return handleError(error)
      }
      config.retryCount += 1
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
      return instance(config)
    },
  )
}

// ─── 导出两个 axios 实例 ──────────────────────────────────

/** 通用 API 实例 — 直连后端（登录、设备列表、路由等） */
const api = createApi(getBaseURL(false))
addResponseInterceptor(api)

/** 数据查询 API 实例 — 走 Worker 代理缓存（遥测数据查询） */
const apiData = createApi(getBaseURL(true))
addResponseInterceptor(apiData)

export { apiData }
export default api
