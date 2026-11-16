import api from '../../index'

export const deviceApi = {
  // GET /api/devices — 设备列表
  list: (params?: Record<string, any>) => api.get('/devices', { params }),

  // POST /api/devices — 注册设备
  register: (data: {
    deviceName: string
    deviceType: string
    firmwareVersion: string
    ipAddress: string
    macAddress: string
    location?: string
  }) => api.post('/devices', data),

  // GET /api/devices/{deviceId} — 设备详情
  getDetail: (deviceId: string) =>
    api.get(`/devices/${encodeURIComponent(deviceId)}`),

  // POST /api/devices/{deviceId}/update — 更新设备（增量）
  update: (deviceId: string, data: Partial<{
    deviceName: string
    deviceType: string
    firmwareVersion: string
    ipAddress: string
    macAddress: string
    location: string
  }>) => api.post(`/devices/${encodeURIComponent(deviceId)}/update`, data),

  // GET /api/devices/{deviceId}/token — 设备引导（需注册时返回的 deviceSecret）
  getToken: (deviceId: string, deviceSecret: string) =>
    api.get(`/devices/${encodeURIComponent(deviceId)}/token`, {
      headers: { 'X-Device-Secret': deviceSecret },
    }),

  // POST /api/devices/{deviceId}/secret — 属主轮换引导密钥（旧设备 Token 同时吊销）
  rotateSecret: (deviceId: string) =>
    api.post(`/devices/${encodeURIComponent(deviceId)}/secret`),

  // POST /api/devices/{deviceId}/delete — 删除设备
  delete: (deviceId: string) =>
    api.post(`/devices/${encodeURIComponent(deviceId)}/delete`),
}
