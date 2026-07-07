import axios from 'axios'
// import qs from 'qs'

// 请求重试配置
const MAX_RETRY_COUNT = 3 // 最大重试次数
const RETRY_DELAY = 1000 // 重试延迟时间（毫秒）

// 扩展 AxiosRequestConfig 类型
declare module 'axios' {
  export interface AxiosRequestConfig {
    retry?: boolean
    retryCount?: number
    fake?: boolean
  }
}

const api = axios.create({
  baseURL: (import.meta.env.DEV && import.meta.env.VITE_ENABLE_PROXY) ? '/proxy/' : import.meta.env.VITE_APP_API_BASEURL,
  timeout: 1000 * 60,
  responseType: 'json',
  withCredentials: true,
})

api.interceptors.request.use(
  (request) => {
    // 全局拦截请求发送前提交的参数
    const appAccountStore = useAppAccountStore()
    // 设置请求头
    if (request.headers) {
      request.headers['Accept-Language'] = 'zh-CN'
      if (appAccountStore.isLogin) {
        // IoT 后端使用 Authorization 头
        request.headers.Authorization = appAccountStore.token
      }
    }
    return request
  },
)

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

api.interceptors.response.use(
  (response) => {
    /**
     * 适配 IoT 后端返回的数据格式
     * IoT 后端格式：{ code: 200, data: object, message: string }
     * code === 200 表示请求成功
     * code === 401 表示需要重新登录
     */
    const res = response.data
    if (typeof res === 'object' && res !== null) {
      // IoT 后端格式：{ code, data, message }
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
      // 兼容旧格式：{ status: 1 | 0, error: string, data: object }
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
    // 获取请求配置
    const config = error.config
    // 如果配置不存在或未启用重试，则直接处理错误
    if (!config || !config.retry) {
      return handleError(error)
    }
    // 设置重试次数
    config.retryCount = config.retryCount || 0
    // 判断是否超过重试次数
    if (config.retryCount >= MAX_RETRY_COUNT) {
      return handleError(error)
    }
    // 重试次数自增
    config.retryCount += 1
    // 延迟重试
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
    // 重新发起请求
    return api(config)
  },
)

export default api
