import api from '../../index'

export const dataApi = {
  // 获取设备监测数据列表（limit + 时间窗口，RFC3339）
  getList: (deviceId: string, params?: {
    limit?: number
    start?: string
    end?: string
  }) => api.get(`/devices/${encodeURIComponent(deviceId)}/sensorData`, { params }),
}
