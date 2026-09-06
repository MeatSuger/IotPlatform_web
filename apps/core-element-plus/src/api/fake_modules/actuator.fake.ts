import type { ProcessedRequest } from 'vite-plugin-fake-server'
import { defineFakeRoute } from 'vite-plugin-fake-server'

interface ActuatorRecord {
  id: string
  name: string
  driver: string
  config?: Record<string, any>
  enabled?: boolean
  createdAt?: string
  updatedAt?: string
}

// 设备类型 = config.transport（driver 为后端枚举占位，固件忽略），
// config 字段与固件 docs/mqtt-api.md transport 参数保持一致
const actuatorTemplates: ActuatorRecord[] = [
  {
    id: 'led1',
    name: '氛围灯',
    driver: 'led',
    config: { transport: 'led_strip', gpio: 48, count: 1 },
    enabled: true,
  },
  {
    id: 'servo1',
    name: '云台舵机',
    driver: 'servo',
    config: { transport: 'pwm', pin: 18, freq_hz: 50 },
    enabled: true,
  },
  {
    id: 'relay1',
    name: '继电器',
    driver: 'led',
    config: { transport: 'gpio', pin: 4, active_high: true, initial: 0 },
    enabled: true,
  },
  {
    id: 'dac1',
    name: 'SPI DAC',
    driver: 'servo',
    config: { transport: 'spi', clk: 6, mosi: 7, cs: 10, freq_hz: 1000000, mode: 0 },
    enabled: true,
  },
]

// 每台设备一份执行器定义（会话内可增删改）
const deviceActuatorMap = new Map<string, ActuatorRecord[]>()
// 每台设备已下发的 config 版本号
const deviceConfigVersionMap = new Map<string, number>()

// 导出单例存储：device.fake.ts 的详情接口（actuators = 定义）与 CRUD 同源
export function getDeviceActuatorDefs(deviceId: string): ActuatorRecord[] {
  if (!deviceActuatorMap.has(deviceId)) {
    deviceActuatorMap.set(deviceId, actuatorTemplates.map(t => ({ ...t, config: { ...t.config } })))
  }
  return deviceActuatorMap.get(deviceId)!
}

export default defineFakeRoute([
  // GET /api/devices/{deviceId}/actuators — 执行器定义列表
  {
    url: '/devices/:deviceId/actuators',
    method: 'GET',
    response: (req: ProcessedRequest) => {
      return {
        code: 200,
        message: 'success',
        data: getDeviceActuatorDefs(req.params.deviceId as string).map(item => ({
          ...item,
          createdAt: item.createdAt ?? new Date().toISOString(),
          updatedAt: item.updatedAt ?? new Date().toISOString(),
        })),
      }
    },
  },

  // GET /api/devices/{deviceId}/actuators/{actuatorId} — 查询单个定义
  {
    url: '/devices/:deviceId/actuators/:actuatorId',
    method: 'GET',
    response: (req: ProcessedRequest) => {
      const item = getDeviceActuatorDefs(req.params.deviceId as string).find(a => a.id === req.params.actuatorId)
      if (!item) {
        return { code: 404, message: '执行器不存在', data: null }
      }
      return {
        code: 200,
        message: 'success',
        data: { ...item, createdAt: item.createdAt ?? new Date().toISOString(), updatedAt: item.updatedAt ?? new Date().toISOString() },
      }
    },
  },

  // POST /api/devices/{deviceId}/actuators — 创建执行器定义
  {
    url: '/devices/:deviceId/actuators',
    method: 'POST',
    response: (req: ProcessedRequest) => {
      const list = getDeviceActuatorDefs(req.params.deviceId as string)
      const body = (req.body || {}) as Partial<ActuatorRecord>
      if (!body.id || !body.driver) {
        return { code: 400, message: 'id、driver 必填', data: null }
      }
      if (!/^[a-z][a-z0-9_]{0,10}$/.test(body.id)) {
        return { code: 400, message: 'id 需小写字母开头，仅含小写字母/数字/下划线，≤11', data: null }
      }
      if (!['led', 'servo', 'speaker'].includes(body.driver)) {
        return { code: 400, message: 'driver 需为 led / servo / speaker（兼容标识）', data: null }
      }
      if (!['gpio', 'pwm', 'spi', 'led_strip'].includes(body.config?.transport)) {
        return { code: 400, message: 'config.transport 需为 gpio / pwm / spi / led_strip', data: null }
      }
      if (list.some(a => a.id === body.id)) {
        return { code: 400, message: '执行器标识已存在', data: null }
      }
      const now = new Date().toISOString()
      const item: ActuatorRecord = {
        id: body.id,
        name: body.name || '',
        driver: body.driver,
        config: body.config,
        enabled: body.enabled ?? true,
        createdAt: now,
        updatedAt: now,
      }
      list.push(item)
      return { code: 200, message: '执行器已创建', data: { ...item } }
    },
  },

  // POST /api/devices/{deviceId}/actuators/{actuatorId}/update — 增量更新执行器定义
  {
    url: '/devices/:deviceId/actuators/:actuatorId/update',
    method: 'POST',
    response: (req: ProcessedRequest) => {
      const list = getDeviceActuatorDefs(req.params.deviceId as string)
      const idx = list.findIndex(a => a.id === req.params.actuatorId)
      if (idx < 0) {
        return { code: 404, message: '执行器不存在', data: null }
      }
      const body = (req.body || {}) as Partial<ActuatorRecord>
      if (!Object.keys(body).length) {
        return { code: 400, message: '无更新字段', data: null }
      }
      if (body.driver && !['led', 'servo', 'speaker'].includes(body.driver)) {
        return { code: 400, message: 'driver 需为 led / servo / speaker（兼容标识）', data: null }
      }
      if (body.config && body.config.transport != null && !['gpio', 'pwm', 'spi', 'led_strip'].includes(body.config.transport)) {
        return { code: 400, message: 'config.transport 需为 gpio / pwm / spi / led_strip', data: null }
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

  // POST /api/devices/{deviceId}/actuators/{actuatorId}/delete — 删除执行器定义
  {
    url: '/devices/:deviceId/actuators/:actuatorId/delete',
    method: 'POST',
    response: (req: ProcessedRequest) => {
      const list = getDeviceActuatorDefs(req.params.deviceId as string)
      const idx = list.findIndex(a => a.id === req.params.actuatorId)
      if (idx < 0) {
        return { code: 404, message: '执行器不存在', data: null }
      }
      list.splice(idx, 1)
      return { code: 200, message: '删除成功', data: null }
    },
  },

  // POST /api/devices/{deviceId}/actuators/apply — 编译全部定义进 config 并版本化下发
  {
    url: '/devices/:deviceId/actuators/apply',
    method: 'POST',
    response: (req: ProcessedRequest) => {
      const list = getDeviceActuatorDefs(req.params.deviceId as string)
      const version = (deviceConfigVersionMap.get(req.params.deviceId as string) ?? 0) + 1
      deviceConfigVersionMap.set(req.params.deviceId as string, version)
      return {
        code: 200,
        message: '执行器配置已下发',
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
