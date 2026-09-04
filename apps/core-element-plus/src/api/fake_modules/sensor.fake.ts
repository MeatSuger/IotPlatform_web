import type { ProcessedRequest } from 'vite-plugin-fake-server'
import { defineFakeRoute } from 'vite-plugin-fake-server'

interface SensorConfigRecord {
  name: string
  identifier: string
  transferType: string
  dataType: string
  unit?: string
}

// 与 device.fake.ts 的传感器模板保持一致（identifier 对齐，便于数值匹配）
const sensorTemplates: SensorConfigRecord[] = [
  { name: '温度', identifier: 'temperature', transferType: '只上报', dataType: '浮点型', unit: '°C' },
  { name: '湿度', identifier: 'humidity', transferType: '只上报', dataType: '浮点型', unit: '%RH' },
  { name: '光照', identifier: 'illuminance', transferType: '只上报', dataType: '浮点型', unit: 'lux' },
  { name: '气压', identifier: 'pressure', transferType: '只上报', dataType: '浮点型', unit: 'hPa' },
]

// 每台设备一份传感器配置（会话内可增删改）
const deviceSensorMap = new Map<string, SensorConfigRecord[]>()

function getSensors(deviceId: string): SensorConfigRecord[] {
  if (!deviceSensorMap.has(deviceId)) {
    deviceSensorMap.set(deviceId, sensorTemplates.map(t => ({ ...t })))
  }
  return deviceSensorMap.get(deviceId)!
}

export default defineFakeRoute([
  // GET /api/devices/{deviceId}/sensors — 传感器配置列表
  {
    url: '/devices/:deviceId/sensors',
    method: 'GET',
    response: (req: ProcessedRequest) => {
      return {
        code: 200,
        message: 'success',
        data: getSensors(req.params.deviceId as string),
      }
    },
  },

  // POST /api/devices/{deviceId}/sensors — 新增传感器配置
  {
    url: '/devices/:deviceId/sensors',
    method: 'POST',
    response: (req: ProcessedRequest) => {
      const list = getSensors(req.params.deviceId as string)
      const body = (req.body || {}) as Partial<SensorConfigRecord>
      if (!body.name || !body.identifier) {
        return { code: 400, message: '名称和标识名必填', data: null }
      }
      if (list.some(s => s.identifier === body.identifier)) {
        return { code: 400, message: '标识名已存在', data: null }
      }
      const item: SensorConfigRecord = {
        name: body.name,
        identifier: body.identifier,
        transferType: body.transferType || '只上报',
        dataType: body.dataType || '浮点型',
        unit: body.unit || undefined,
      }
      list.push(item)
      return { code: 200, message: '传感器添加成功', data: item }
    },
  },

  // POST /api/devices/{deviceId}/sensors/{identifier}/update — 更新传感器配置
  {
    url: '/devices/:deviceId/sensors/:identifier/update',
    method: 'POST',
    response: (req: ProcessedRequest) => {
      const list = getSensors(req.params.deviceId as string)
      const idx = list.findIndex(s => s.identifier === req.params.identifier)
      if (idx < 0) {
        return { code: 404, message: '传感器不存在', data: null }
      }
      const body = (req.body || {}) as Partial<SensorConfigRecord>
      list[idx] = {
        ...list[idx],
        ...body,
        identifier: list[idx].identifier,
      }
      return { code: 200, message: '传感器更新成功', data: list[idx] }
    },
  },

  // POST /api/devices/{deviceId}/sensors/{identifier}/delete — 删除传感器配置
  {
    url: '/devices/:deviceId/sensors/:identifier/delete',
    method: 'POST',
    response: (req: ProcessedRequest) => {
      const list = getSensors(req.params.deviceId as string)
      const idx = list.findIndex(s => s.identifier === req.params.identifier)
      if (idx < 0) {
        return { code: 404, message: '传感器不存在', data: null }
      }
      list.splice(idx, 1)
      return { code: 200, message: '传感器删除成功', data: null }
    },
  },
])
