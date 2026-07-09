import { apiData } from '../../index'

export const dataApi = {
  // 获取设备监测数据列表（通过 Cloudflare Worker 代理 + 缓存）
  getList: (deviceId: string, params?: Record<string, any>) =>
    apiData.get(`/data/${encodeURIComponent(deviceId)}/Data/list`, { params }),
}
