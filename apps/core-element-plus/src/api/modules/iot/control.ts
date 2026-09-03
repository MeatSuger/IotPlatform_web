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

// ==================== 下行命令（DownlinkCmd） ====================
export type CommandType = 'config' | 'control' | 'ota' | 'message'

export interface CommandPayload {
  type: CommandType
  payload: Record<string, any>
}

// ==================== 设备配置快照（DeviceConfig） ====================
export interface DeviceConfigPayload {
  network?: {
    wifi?: { ssid?: string, password?: string }
    mqtt?: { host?: string, port?: number, tls?: boolean }
  }
  sensor?: {
    reportInterval?: number
    thresholds?: Record<string, { min?: number, max?: number }>
  }
  actuator?: {
    mode?: string
    schedule?: { on?: string, off?: string }
    pwm?: number
  }
  camera?: {
    protocol?: string
    smtp?: {
      host?: string
      port?: number
      ssl?: boolean
      username?: string
      password?: string
    }
    snapshotInterval?: number
  }
  ota?: { fwUrl?: string, fwVersion?: string, md5?: string }
}

export interface DeviceConfig {
  deviceId: string
  version: number
  status: 'pending' | 'acked' | ''
  payload: DeviceConfigPayload | null
  reportedVersion: number
  reportedPayload: DeviceConfigPayload | null
  updatedAt?: string
}

// ==================== HTTP API ====================
export const controlApi = {
  // GET /api/devices/{deviceId}
  getDetail: (deviceId: string) =>
    api.get(`/devices/${encodeURIComponent(deviceId)}`),

  // POST /api/devices/{deviceId}/commands — 下发控制指令
  sendCommand: (deviceId: string, data: CommandPayload) =>
    api.post(`/devices/${encodeURIComponent(deviceId)}/commands`, data),

  // GET /api/devices/{deviceId}/config — 查询设备配置快照
  getConfig: (deviceId: string) =>
    api.get(`/devices/${encodeURIComponent(deviceId)}/config`),

  // POST /api/devices/{deviceId}/config — 设置并下发设备配置
  setConfig: (deviceId: string, config: DeviceConfigPayload) =>
    api.post(`/devices/${encodeURIComponent(deviceId)}/config`, { config }),
}
