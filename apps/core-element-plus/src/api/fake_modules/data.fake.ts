import type { ProcessedRequest } from 'vite-plugin-fake-server'
import { faker } from '@faker-js/faker'
import { defineFakeRoute } from 'vite-plugin-fake-server'

function generateDataList(deviceId: string, limit = 20) {
  return Array.from({ length: limit }, () => ({
    // 生成最近 7 天的数据，便于验证时间范围过滤
    timestamp: faker.date.recent({ days: 7 }).toISOString(),
    name: `传感器-${deviceId}`,
    type: faker.helpers.arrayElement(['temperature', 'humidity', 'illuminance', 'pressure']),
    value: faker.helpers.arrayElement([
      `${faker.number.float({ min: 18, max: 35, fractionDigits: 1 })}°C`,
      `${faker.number.float({ min: 30, max: 80, fractionDigits: 1 })}%RH`,
      `${faker.number.int({ min: 100, max: 5000 })}lux`,
      `${faker.number.float({ min: 990, max: 1030, fractionDigits: 1 })}hPa`,
    ]),
  }))
}

export default defineFakeRoute([
  {
    url: '/devices/:deviceId/sensorData',
    method: 'GET',
    response: (req: ProcessedRequest) => {
      const { deviceId } = req.params
      const limit = Number(req.query?.limit) || 20
      // 服务端时间范围过滤（前端传入毫秒时间戳）
      const startTime = Number(req.query?.startTime) || 0
      const endTime = Number(req.query?.endTime) || Number.MAX_SAFE_INTEGER
      const list = generateDataList(deviceId as string, Math.max(limit * 2, 20))
      const filtered = list.filter((d) => {
        const t = Date.parse(d.timestamp)
        return t >= startTime && t <= endTime
      })
      return {
        code: 200,
        message: 'success',
        data: filtered,
      }
    },
  },
])
