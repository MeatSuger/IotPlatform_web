import type { ProcessedRequest } from 'vite-plugin-fake-server'
import { faker } from '@faker-js/faker'
import { defineFakeRoute } from 'vite-plugin-fake-server'

function generateDataList(deviceId: string, limit = 50) {
  return Array.from({ length: limit }, () => ({
    // 生成最近 7 天的数据，便于验证时间范围过滤
    timestamp: faker.date.recent({ days: 7 }).toISOString(),
    name: `传感器-${deviceId}`,
    type: faker.helpers.arrayElement(['temperature', 'humidity', 'illuminance', 'pressure']),
    value: faker.helpers.arrayElement([
      faker.number.float({ min: 18, max: 35, fractionDigits: 1 }),
      faker.number.float({ min: 30, max: 80, fractionDigits: 1 }),
      faker.number.int({ min: 100, max: 5000 }),
      faker.number.float({ min: 990, max: 1030, fractionDigits: 1 }),
    ]),
  }))
}

export default defineFakeRoute([
  {
    url: '/devices/:deviceId/sensorData',
    method: 'GET',
    response: (req: ProcessedRequest) => {
      const { deviceId } = req.params
      const limit = Number(req.query?.limit) || 50
      // 服务端时间范围过滤（查询参数为 RFC3339 字符串）
      const parseTime = (val: unknown): number => {
        const t = Date.parse(String(val ?? ''))
        return Number.isNaN(t) ? NaN : t
      }
      const startTime = parseTime(req.query?.start)
      const endTime = parseTime(req.query?.end)
      const list = generateDataList(deviceId as string, Math.max(limit * 2, 50))
      const filtered = list.filter((d) => {
        const t = Date.parse(d.timestamp)
        if (!Number.isNaN(startTime) && t < startTime) {
          return false
        }
        if (!Number.isNaN(endTime) && t > endTime) {
          return false
        }
        return true
      })
      // 结果按时间倒序
      filtered.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      return {
        code: 200,
        message: 'success',
        data: filtered.slice(0, limit),
      }
    },
  },
])
