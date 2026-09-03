import type { ProcessedRequest } from 'vite-plugin-fake-server'
import { faker } from '@faker-js/faker'
import { defineFakeRoute } from 'vite-plugin-fake-server'

const sensorsTemplates = [
  { name: '温度', identifier: 'temperature', transferType: '只上报', dataType: '浮点型', unit: '°C', min: 18, max: 35 },
  { name: '湿度', identifier: 'humidity', transferType: '只上报', dataType: '浮点型', unit: '%RH', min: 30, max: 80 },
  { name: '光照', identifier: 'illuminance', transferType: '只上报', dataType: '浮点型', unit: 'lux', min: 100, max: 5000 },
  { name: '气压', identifier: 'pressure', transferType: '只上报', dataType: '浮点型', unit: 'hPa', min: 990, max: 1030 },
]

function generateSensors() {
  const count = faker.number.int({ min: 1, max: 3 })
  return faker.helpers.arrayElements(sensorsTemplates, count).map(t => ({
    name: t.name,
    identifier: t.identifier,
    transferType: t.transferType,
    dataType: t.dataType,
    value: faker.number.float({ min: t.min, max: t.max, fractionDigits: 1 }).toString(),
    unit: t.unit,
  }))
}

interface DeviceRecord {
  id: number
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
  sensors: ReturnType<typeof generateSensors>
}

function createDevice(id: number): DeviceRecord {
  const now = faker.date.recent({ days: 7 }).toISOString()
  const createdAt = faker.date.past({ years: 1 }).toISOString()
  const status: 'ONLINE' | 'OFFLINE' = faker.helpers.arrayElement(['ONLINE', 'ONLINE', 'ONLINE', 'OFFLINE'])

  return {
    id,
    deviceId: faker.string.alphanumeric({ length: 6, casing: 'lower' }),
    deviceName: faker.helpers.arrayElement([
      'ESP32-devkit-c',
      'ESP32-sensor-A',
      'ESP32-sensor-B',
      '温湿度传感器01',
      '智能网关',
      '环境监测仪',
    ]),
    deviceType: faker.helpers.arrayElement(['temperature', 'humidity', 'gateway', 'environment']),
    status,
    lastActiveTime: status === 'ONLINE' ? now : faker.date.recent({ days: 30 }).toISOString(),
    createdAt,
    updatedAt: now,
    ownerId: 1001,
    firmwareVersion: `v${faker.number.int({ min: 1, max: 3 })}.${faker.number.int({ min: 0, max: 9 })}.${faker.number.int({ min: 0, max: 9 })}`,
    ipAddress: faker.internet.ipv4(),
    macAddress: faker.internet.mac(),
    location: faker.helpers.arrayElement(['', '机房A', '机房B', '实验室']),
    sensors: generateSensors(),
  }
}

const deviceDetailMap = new Map<number, DeviceRecord>()
const deviceList: DeviceRecord[] = Array.from({ length: 12 }, (_, i) => {
  const device = createDevice(i + 1)
  deviceDetailMap.set(device.id, device)
  return device
})

function getByDeviceId(deviceId: string): DeviceRecord | undefined {
  return deviceList.find(d => d.deviceId === deviceId)
}

export default defineFakeRoute([
  // GET /api/devices — 支持 devicename 模糊搜索 + from/limit 分页
  {
    url: '/devices',
    method: 'GET',
    response: (req: ProcessedRequest) => {
      const { devicename, from = 0, limit = 10 } = req.query
      const keyword = String(devicename ?? '').trim().toLowerCase()
      const matched = keyword
        ? deviceList.filter(d => d.deviceName.toLowerCase().includes(keyword) || d.deviceId.toLowerCase().includes(keyword))
        : deviceList
      const total = matched.length
      const start = ~~from
      const end = start + ~~limit
      return {
        code: 200,
        message: 'success',
        data: {
          list: matched.slice(start, end).map(({ sensors: _, ...rest }) => rest),
          total,
        },
      }
    },
  },

  // GET /api/devices/{deviceId}
  {
    url: '/devices/:deviceId',
    method: 'GET',
    response: (req: ProcessedRequest) => {
      const device = getByDeviceId(req.params.deviceId as string)
      if (device) {
        return { code: 200, message: 'success', data: device }
      }
      return { code: 404, message: '设备不存在', data: null }
    },
  },

  // POST /api/devices — 注册设备，返回 deviceId + deviceToken
  {
    url: '/devices',
    method: 'POST',
    response: (req: ProcessedRequest) => {
      const body = req.body
      const now = new Date().toISOString()
      const deviceToken = faker.string.uuid()
      const newDevice: DeviceRecord = {
        id: deviceList.length + 1,
        deviceId: faker.string.alphanumeric({ length: 6, casing: 'lower' }),
        deviceName: body.deviceName || '新设备',
        deviceType: body.deviceType || 'temperature',
        status: 'ONLINE',
        lastActiveTime: now,
        createdAt: now,
        updatedAt: now,
        ownerId: 1001,
        firmwareVersion: body.firmwareVersion || 'v1.0.0',
        ipAddress: body.ipAddress || faker.internet.ipv4(),
        macAddress: body.macAddress || faker.internet.mac(),
        location: body.location || '',
        sensors: generateSensors(),
      }
      deviceList.push(newDevice)
      deviceDetailMap.set(newDevice.id, newDevice)
      return {
        code: 200,
        message: '设备注册成功',
        data: { deviceId: newDevice.deviceId, deviceToken },
      }
    },
  },

  // POST /api/devices/{deviceId}/update — 增量更新设备
  {
    url: '/devices/:deviceId/update',
    method: 'POST',
    response: (req: ProcessedRequest) => {
      const device = getByDeviceId(req.params.deviceId as string)
      if (!device) {
        return { code: 404, message: '设备不存在', data: null }
      }
      const body = req.body || {}
      const updatableFields = [
        'deviceName',
        'deviceType',
        'firmwareVersion',
        'ipAddress',
        'macAddress',
        'location',
      ] as const
      const keys = Object.keys(body).filter(k => (updatableFields as readonly string[]).includes(k))
      if (!keys.length) {
        return { code: 400, message: '无更新字段', data: null }
      }
      keys.forEach((key) => {
        ;(device as any)[key] = body[key]
      })
      device.updatedAt = new Date().toISOString()
      return { code: 200, message: '设备更新成功', data: device }
    },
  },

  // GET /api/devices/{deviceId}/token — 获取设备 Token（复用）
  {
    url: '/devices/:deviceId/token',
    method: 'GET',
    response: (req: ProcessedRequest) => {
      const device = getByDeviceId(req.params.deviceId as string)
      if (!device) {
        return { code: 404, message: '设备不存在', data: null }
      }
      const tokenMap = new Map<string, string>()
      if (!tokenMap.has(device.deviceId)) {
        tokenMap.set(device.deviceId, faker.string.uuid())
      }
      return {
        code: 200,
        message: 'success',
        data: { deviceId: device.deviceId, deviceToken: tokenMap.get(device.deviceId) },
      }
    },
  },

  // POST /api/devices/{deviceId}/delete
  {
    url: '/devices/:deviceId/delete',
    method: 'POST',
    response: (req: ProcessedRequest) => {
      const idx = deviceList.findIndex(d => d.deviceId === req.params.deviceId)
      if (idx >= 0) {
        deviceList.splice(idx, 1)
        return { code: 200, message: '设备已删除', data: null }
      }
      return { code: 404, message: '设备不存在', data: null }
    },
  },
])
