import type { Actuator } from './actuator'
import type { Sensor } from './sensor'
import api from '../../index'

// ==================== 设备详情（真实 API: GET /api/devices/{deviceId}） ====================
// 1.7.0 起详情即物模型视图（服务端完成 join）：
//   - sensors:   传感器物模型数组 = 定义字段 + latest（最近一次上报值，null = 从未上报）
//   - actuators: 执行器物模型数组（= 定义，含 config.transport）
// 设备无定义时两数组均为 []（非 null）。

// 传感器定义 + 最近一次上报值
interface DetailSensor extends Sensor {
  latest: { value: number | string | boolean | null, timestamp?: string } | null
}

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
  sensors: DetailSensor[] | null
  actuators: Actuator[] | null
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
