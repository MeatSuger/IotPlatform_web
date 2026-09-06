import api from '../../index'

// ==================== 传感器定义（物模型，后端 API.md 4.6） ====================
// 与设备详情返回的传感器"数值"（sensors）分离：定义决定展示哪些传感器、如何采样/告警，数值由设备详情填充。
export interface SensorSpecs {
  min?: number
  max?: number
  step?: number
}

export interface SensorThresholds {
  min?: number
  max?: number
  alarm?: boolean
}

export interface Sensor {
  // 标识符：字母开头，仅含字母/数字/下划线，≤50（创建必填、不可变）
  id: string
  name: string
  // 类别：temperature / humidity / light / switch / custom
  type: string
  dataType?: 'float' | 'int' | 'bool' | 'text' | 'enum'
  unit?: string
  specs?: SensorSpecs
  reportInterval?: number // 0 = 继承设备全局配置
  thresholds?: SensorThresholds
  attrs?: Record<string, any>
  enabled?: boolean
  createdAt?: string
  updatedAt?: string
}

export type SensorCreatePayload = Pick<Sensor, 'id' | 'name' | 'type'> & Partial<Omit<Sensor, 'id' | 'name' | 'type' | 'createdAt' | 'updatedAt'>>

export type SensorUpdatePayload = Partial<Omit<Sensor, 'id' | 'createdAt' | 'updatedAt'>>

export const sensorApi = {
  // GET /api/devices/{deviceId}/sensors — 传感器定义列表
  getList: (deviceId: string) =>
    api.get(`/devices/${encodeURIComponent(deviceId)}/sensors`),

  // GET /api/devices/{deviceId}/sensors/{sensorId} — 查询单个定义
  get: (deviceId: string, sensorId: string) =>
    api.get(`/devices/${encodeURIComponent(deviceId)}/sensors/${encodeURIComponent(sensorId)}`),

  // POST /api/devices/{deviceId}/sensors — 创建传感器定义
  create: (deviceId: string, data: SensorCreatePayload) =>
    api.post(`/devices/${encodeURIComponent(deviceId)}/sensors`, data),

  // POST /api/devices/{deviceId}/sensors/{sensorId}/update — 增量更新传感器定义
  update: (deviceId: string, sensorId: string, data: SensorUpdatePayload) =>
    api.post(`/devices/${encodeURIComponent(deviceId)}/sensors/${encodeURIComponent(sensorId)}/update`, data),

  // POST /api/devices/{deviceId}/sensors/{sensorId}/delete — 删除传感器定义
  remove: (deviceId: string, sensorId: string) =>
    api.post(`/devices/${encodeURIComponent(deviceId)}/sensors/${encodeURIComponent(sensorId)}/delete`),

  // POST /api/devices/{deviceId}/sensors/apply — 下发传感器配置（编译进 config 并版本化下发）
  apply: (deviceId: string) =>
    api.post(`/devices/${encodeURIComponent(deviceId)}/sensors/apply`),
}
