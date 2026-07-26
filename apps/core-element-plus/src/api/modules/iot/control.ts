import api from '../../index'

// ==================== 传感器 ====================
export interface SensorItem {
  name: string
  identifier: string
  transferType: string
  dataType: string
  value: string
  unit?: string
}

// ==================== 设备详情（真实 API: GET /api/device/{deviceId}/Data） ====================
export interface DeviceDetail {
  deviceId: string
  deviceName: string
  deviceType: string
  status: 'ONLINE' | 'OFFLINE'
  lastActiveTime: string
  createdAt: string
  updatedAt: string
  ownerId: number
  firmwareVersion: string
  ipAddress: string
  macAddress: string
  location: string
  sensors: SensorItem[] | null
}

// ==================== HTTP API ====================
export const controlApi = {
  // GET /api/device/{deviceId}/Data
  getDetail: (deviceId: string) =>
    api.get(`/device/${encodeURIComponent(deviceId)}/Data`),

  // POST /api/device/{deviceId}/cmd — 下发控制指令（预留）
  sendCommand: (deviceId: string, data: Record<string, any>) =>
    api.post(`/device/${encodeURIComponent(deviceId)}/cmd`, data),
}
