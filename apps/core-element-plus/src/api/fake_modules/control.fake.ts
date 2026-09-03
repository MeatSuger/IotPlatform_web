import type { ProcessedRequest } from 'vite-plugin-fake-server'
import { defineFakeRoute } from 'vite-plugin-fake-server'

interface FakeDeviceConfig {
  version: number
  status: 'pending' | 'acked' | ''
  payload: Record<string, any> | null
  reportedVersion: number
  reportedPayload: Record<string, any> | null
  updatedAt: string
}

const configMap = new Map<string, FakeDeviceConfig>()
let cmdSeq = 100

export default defineFakeRoute([
  // POST /api/devices/{deviceId}/commands — 下发命令
  {
    url: '/devices/:deviceId/commands',
    method: 'POST',
    response: (req: ProcessedRequest) => {
      const { deviceId } = req.params
      const body = req.body || {}
      if (!body.type || body.payload == null) {
        return { code: 400, message: 'type 与 payload 必填', data: null }
      }
      cmdSeq += 1
      return {
        code: 200,
        message: '命令已下发',
        data: {
          id: cmdSeq,
          deviceId,
          type: body.type,
          payload: body.payload,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      }
    },
  },

  // GET /api/devices/{deviceId}/config — 查询配置快照
  {
    url: '/devices/:deviceId/config',
    method: 'GET',
    response: (req: ProcessedRequest) => {
      const { deviceId } = req.params
      const config = configMap.get(deviceId as string)
      if (config) {
        return { code: 200, message: 'success', data: config }
      }
      return {
        code: 200,
        message: 'success',
        data: {
          deviceId,
          version: 0,
          status: '',
          payload: null,
          reportedVersion: 0,
          reportedPayload: null,
        },
      }
    },
  },

  // POST /api/devices/{deviceId}/config — 设置并下发配置
  {
    url: '/devices/:deviceId/config',
    method: 'POST',
    response: (req: ProcessedRequest) => {
      const { deviceId } = req.params
      const config = (req.body || {}).config
      if (config == null) {
        return { code: 400, message: 'config 缺失', data: null }
      }
      const prev = configMap.get(deviceId as string)
      const next: FakeDeviceConfig = {
        version: (prev?.version ?? 0) + 1,
        status: 'pending',
        payload: config,
        reportedVersion: 0,
        reportedPayload: null,
        updatedAt: new Date().toISOString(),
      }
      configMap.set(deviceId as string, next)
      return {
        code: 200,
        message: '配置已保存并下发',
        data: { deviceId, version: next.version, status: 'pending' },
      }
    },
  },
])
