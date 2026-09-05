import type { ProcessedRequest } from 'vite-plugin-fake-server'
import { faker } from '@faker-js/faker'
import { defineFakeRoute } from 'vite-plugin-fake-server'

const logPool: Array<{ type: string, content: string }> = [
  { type: 'online', content: '设备上线，建立连接' },
  { type: 'offline', content: '设备离线，连接断开' },
  { type: 'command', content: '下发控制指令' },
  { type: 'config', content: '下发配置（version 递增）' },
  { type: 'config', content: '设备配置回执（acked）' },
  { type: 'sensor', content: '传感器数据上报' },
  { type: 'sensor', content: '传感器越限告警' },
]

function generateLogs(deviceId: string, count = 200) {
  return Array.from({ length: count }, (_, i) => {
    const item = faker.helpers.arrayElement(logPool)
    return {
      id: i + 1,
      deviceId,
      type: item.type,
      content: item.content,
      detail: item.type === 'command'
        ? `{"GPIO": "${faker.number.int({ min: 1, max: 8 })}", "action": "${faker.helpers.arrayElement(['on', 'off', 'set'])}"}`
        : item.type === 'config'
          ? `{"version": ${faker.number.int({ min: 1, max: 20 })}}`
          : item.type === 'sensor'
            ? `{"value": ${faker.number.float({ min: 0, max: 100, fractionDigits: 1 })}}`
            : undefined,
      createdAt: faker.date.recent({ days: 7 }).toISOString(),
    }
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

const deviceLogMap = new Map<string, ReturnType<typeof generateLogs>>()

function getLogs(deviceId: string) {
  if (!deviceLogMap.has(deviceId)) {
    deviceLogMap.set(deviceId, generateLogs(deviceId))
  }
  return deviceLogMap.get(deviceId)!
}

export default defineFakeRoute([
  // GET /api/devices/{deviceId}/logs — 设备日志列表（预留，分页 + 类型/时间过滤）
  {
    url: '/devices/:deviceId/logs',
    method: 'GET',
    response: (req: ProcessedRequest) => {
      const { deviceId } = req.params
      const pageNum = Number(req.query?.pageNum) || 0
      const pageSize = Number(req.query?.pageSize) || 20
      const type = String(req.query?.type ?? '')
      const start = Date.parse(String(req.query?.start ?? ''))
      const end = Date.parse(String(req.query?.end ?? ''))

      let list = getLogs(deviceId as string)
      if (type) {
        list = list.filter(item => item.type === type)
      }
      if (!Number.isNaN(start)) {
        list = list.filter(item => Date.parse(item.createdAt) >= start)
      }
      if (!Number.isNaN(end)) {
        list = list.filter(item => Date.parse(item.createdAt) <= end)
      }
      const total = list.length
      const startIdx = pageNum * pageSize
      return {
        code: 200,
        message: 'success',
        data: {
          records: list.slice(startIdx, startIdx + pageSize),
          total,
          size: pageSize,
          current: pageNum,
          pages: Math.ceil(total / pageSize),
        },
      }
    },
  },
])
