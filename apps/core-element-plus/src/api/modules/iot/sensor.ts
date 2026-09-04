import api from '../../index'

// ==================== 传感器配置（预留接口，后端待实现，见 API.md 后续更新） ====================
// 传感器"定义/配置"：名称 / 标识名 / 传输类型 / 数据类型 / 单位。
// 与设备详情返回的传感器"数值"（sensors）分离：配置决定展示哪些传感器，数值由设备详情填充。
export interface SensorConfig {
  name: string
  identifier: string
  transferType: string
  dataType: string
  unit?: string
}

export const sensorApi = {
  // GET /api/devices/{deviceId}/sensors — 传感器配置列表
  getList: (deviceId: string) =>
    api.get(`/devices/${encodeURIComponent(deviceId)}/sensors`),

  // POST /api/devices/{deviceId}/sensors — 新增传感器配置
  create: (deviceId: string, data: SensorConfig) =>
    api.post(`/devices/${encodeURIComponent(deviceId)}/sensors`, data),

  // POST /api/devices/{deviceId}/sensors/{identifier}/update — 更新传感器配置
  update: (deviceId: string, identifier: string, data: Partial<SensorConfig>) =>
    api.post(`/devices/${encodeURIComponent(deviceId)}/sensors/${encodeURIComponent(identifier)}/update`, data),

  // POST /api/devices/{deviceId}/sensors/{identifier}/delete — 删除传感器配置
  remove: (deviceId: string, identifier: string) =>
    api.post(`/devices/${encodeURIComponent(deviceId)}/sensors/${encodeURIComponent(identifier)}/delete`),
}
