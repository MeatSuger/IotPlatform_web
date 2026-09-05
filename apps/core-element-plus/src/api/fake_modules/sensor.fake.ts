import type { ProcessedRequest } from 'vite-plugin-fake-server'
import { defineFakeRoute } from 'vite-plugin-fake-server'

interface SensorRecord {
  id: string
  name: string
  type: string
  dataType: string
  unit?: string
  specs?: { min?: number, max?: number, step?: number }
  reportInterval?: number
  thresholds?: { min?: number, max?: number, alarm?: boolean }
  attrs?: Record<string, any>
  enabled?: boolean
  createdAt?: string
  updatedAt?: string
}

// 与 device.fake.ts 的传感器上报值标识保持一致（id 对齐，便于数值匹配）
const sensorTemplates: SensorRecord[] = [
  {
    id: 'temperature',
    name: '温度',
    type: 'temperature',
    dataType: 'float',
    unit: '°C',
    specs: { min: -40, max: 125, step: 0.1 },
    reportInterval: 60,
    thresholds: { min: 0, max: 100, alarm: true },
    enabled: true,
  },
  {
    id: 'humidity',
    name: '湿度',
    type: 'humidity',
    dataType: 'float',
    unit: '%RH',
    specs: { min: 0, max: 100, step: 0.1 },
    reportInterval: 60,
    enabled: true,
  },
  {
    id: 'illuminance',
    name: '光照',
    type: 'light',
    dataType: 'float',
    unit: 'lux',
    specs: { min: 0, max: 10000, step: 1 },
    reportInterval: 60,
    enabled: true,
  },
  {
    id: 'pressure',
    name: '气压',
    type: 'custom',
    dataType: 'float',
    unit: 'hPa',
    specs: { min: 900, max: 1100, step: 0.1 },
    reportInterval: 60,
    enabled: true,
  },
]

// 每台设备一份传感器定义（会话内可增删改）
const deviceSensorMap = new Map<string, SensorRecord[]>()
// 每台设备已下发的 config 版本号
const deviceConfigVersionMap = new Map<string, number>()

function getSensors(deviceId: string): SensorRecord[] {
  if (!deviceSensorMap.has(deviceId)) {
    deviceSensorMap.set(deviceId, sensorTemplates.map(t => ({ ...t })))
  }
  return deviceSensorMap.get(deviceId)!
}

export default defineFakeRoute([
  // GET /api/devices/{deviceId}/sensors — 传感器定义列表
  {
    url: '/devices/:deviceId/sensors',
    method: 'GET',
    response: (req: ProcessedRequest) => {
      return {
        code: 200,
        message: 'success',
        data: getSensors(req.params.deviceId as string).map(item => ({
          ...item,
          createdAt: item.createdAt ?? new Date().toISOString(),
          updatedAt: item.updatedAt ?? new Date().toISOString(),
        })),
      }
    },
  },

  // GET /api/devices/{deviceId}/sensors/{sensorId} — 查询单个定义
  {
    url: '/devices/:deviceId/sensors/:sensorId',
    method: 'GET',
    response: (req: ProcessedRequest) => {
      const item = getSensors(req.params.deviceId as string).find(s => s.id === req.params.sensorId)
      if (!item) {
        return { code: 404, message: '传感器不存在', data: null }
      }
      return {
        code: 200,
        message: 'success',
        data: { ...item, createdAt: item.createdAt ?? new Date().toISOString(), updatedAt: item.updatedAt ?? new Date().toISOString() },
      }
    },
  },

  // POST /api/devices/{deviceId}/sensors — 创建传感器定义
  {
    url: '/devices/:deviceId/sensors',
    method: 'POST',
    response: (req: ProcessedRequest) => {
      const list = getSensors(req.params.deviceId as string)
      const body = (req.body || {}) as Partial<SensorRecord>
      if (!body.id || !body.name || !body.type) {
        return { code: 400, message: 'id、name、type 必填', data: null }
      }
      if (!/^[a-z][a-z0-9_]{0,49}$/.test(body.id)) {
        return { code: 400, message: 'id 需小写字母开头，仅含小写字母/数字/下划线，≤50', data: null }
      }
      if (list.some(s => s.id === body.id)) {
        return { code: 400, message: '传感器标识已存在', data: null }
      }
      const now = new Date().toISOString()
      const item: SensorRecord = {
        id: body.id,
        name: body.name,
        type: body.type,
        dataType: body.dataType || 'float',
        unit: body.unit || undefined,
        specs: body.specs,
        reportInterval: body.reportInterval,
        thresholds: body.thresholds,
        attrs: body.attrs,
        enabled: body.enabled ?? true,
        createdAt: now,
        updatedAt: now,
      }
      list.push(item)
      return { code: 200, message: '传感器已创建', data: { ...item } }
    },
  },

  // POST /api/devices/{deviceId}/sensors/{sensorId}/update — 增量更新传感器定义
  {
    url: '/devices/:deviceId/sensors/:sensorId/update',
    method: 'POST',
    response: (req: ProcessedRequest) => {
      const list = getSensors(req.params.deviceId as string)
      const idx = list.findIndex(s => s.id === req.params.sensorId)
      if (idx < 0) {
        return { code: 404, message: '传感器不存在', data: null }
      }
      const body = (req.body || {}) as Partial<SensorRecord>
      if (!Object.keys(body).length) {
        return { code: 400, message: '无更新字段', data: null }
      }
      list[idx] = {
        ...list[idx],
        ...body,
        id: list[idx].id,
        updatedAt: new Date().toISOString(),
      }
      return { code: 200, message: 'success', data: { ...list[idx] } }
    },
  },

  // POST /api/devices/{deviceId}/sensors/{sensorId}/delete — 删除传感器定义
  {
    url: '/devices/:deviceId/sensors/:sensorId/delete',
    method: 'POST',
    response: (req: ProcessedRequest) => {
      const list = getSensors(req.params.deviceId as string)
      const idx = list.findIndex(s => s.id === req.params.sensorId)
      if (idx < 0) {
        return { code: 404, message: '传感器不存在', data: null }
      }
      list.splice(idx, 1)
      return { code: 200, message: '删除成功', data: null }
    },
  },

  // POST /api/devices/{deviceId}/sensors/apply — 编译全部定义进 config 并版本化下发
  {
    url: '/devices/:deviceId/sensors/apply',
    method: 'POST',
    response: (req: ProcessedRequest) => {
      const list = getSensors(req.params.deviceId as string)
      const version = (deviceConfigVersionMap.get(req.params.deviceId as string) ?? 0) + 1
      deviceConfigVersionMap.set(req.params.deviceId as string, version)
      return {
        code: 200,
        message: '传感器配置已下发',
        data: {
          deviceId: req.params.deviceId,
          version,
          status: 'pending',
          count: list.length,
        },
      }
    },
  },
])
