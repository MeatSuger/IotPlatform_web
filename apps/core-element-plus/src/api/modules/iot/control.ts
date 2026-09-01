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

// ==================== 设备详情（真实 API: GET /api/devices/{deviceId}） ====================
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
  // GET /api/devices/{deviceId}
  getDetail: (deviceId: string) =>
    api.get(`/devices/${encodeURIComponent(deviceId)}`),

  // POST /api/devices/{deviceId}/commands — 下发控制指令（预留）
  sendCommand: (deviceId: string, data: Record<string, any>) =>
    api.post(`/devices/${encodeURIComponent(deviceId)}/commands`, data),
}
