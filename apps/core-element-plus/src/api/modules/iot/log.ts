import api from '../../index'

// ==================== 设备日志（预留接口，后端待实现，见 API.md 后续更新） ====================
// 事件类型枚举（预留，以后端 API.md 最终定义为准）
export type DeviceLogType = 'online' | 'offline' | 'command' | 'config' | 'sensor'

export interface DeviceLogItem {
  id: number
  deviceId: string
  type: DeviceLogType
  content: string
  detail?: string
  createdAt: string
}

export const logApi = {
  // GET /api/devices/{deviceId}/logs — 设备日志列表（预留）
  getList: (deviceId: string, params?: {
    pageNum?: number
    pageSize?: number
    type?: DeviceLogType | ''
    start?: string
    end?: string
  }) => api.get(`/devices/${encodeURIComponent(deviceId)}/logs`, { params }),
}
