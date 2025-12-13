import axios from 'axios'
import { ElMessage } from 'element-plus'

const service = axios.create({
  baseURL: 'http://localhost:8181/api',
  // baseURL: 'https://api.meatsuger.top/api',
  withCredentials: true,
  timeout: 12000,
})

service.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || localStorage.getItem('satoken')
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
  (error) => {
    const status = error?.response?.status
    if (status === 401) {
      ElMessage.error('登录已过期，请重新登录')
    } else {
      ElMessage.error(error?.response?.data?.message || '请求失败')
    }
    return Promise.reject(error)
  },
)

export default service
