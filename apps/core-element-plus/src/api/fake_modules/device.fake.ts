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
  // GET /api/device/list
  {
    url: '/device/list',
    method: 'GET',
    response: () => ({
      code: 200,
      message: 'success',
      data: deviceList.map(({ sensors: _, ...rest }) => rest),
    }),
  },

  // GET /api/device/{deviceId}/Data
  {
    url: '/device/:deviceId/Data',
    method: 'GET',
    response: (req: ProcessedRequest) => {
      const device = getByDeviceId(req.params.deviceId as string)
      if (device) {
        return { code: 200, message: 'success', data: device }
      }
      return { code: 404, message: '设备不存在', data: null }
    },
  },

  // POST /api/device/register
  {
    url: '/device/register',
    method: 'POST',
    response: (req: ProcessedRequest) => {
      const body = req.body
      const now = new Date().toISOString()
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
        location: '',
        sensors: generateSensors(),
      }
      deviceList.push(newDevice)
      deviceDetailMap.set(newDevice.id, newDevice)
      return { code: 200, message: '设备注册成功', data: newDevice }
    },
  },

  // POST /api/device/{deviceId}/delete
  {
    url: '/device/:deviceId/delete',
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
