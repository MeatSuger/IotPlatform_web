import type { ProcessedRequest } from 'vite-plugin-fake-server'
import { faker } from '@faker-js/faker'
import { defineFakeRoute } from 'vite-plugin-fake-server'

function generateDataList(deviceId: string, limit = 20) {
  return Array.from({ length: limit }, () => ({
    timestamp: faker.date.recent({ days: 1 }).toISOString(),
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
    url: '/data/:deviceId/Data/list',
    method: 'GET',
    response: (req: ProcessedRequest) => {
      const { deviceId } = req.params
      const limit = Number(req.query?.limit) || 20
      return {
        code: 200,
        message: 'success',
        data: generateDataList(deviceId as string, limit),
      }
    },
  },
])
