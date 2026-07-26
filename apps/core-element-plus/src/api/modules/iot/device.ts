import api from '../../index'

export const deviceApi = {
  // GET /api/device/list — 设备列表
  list: (params?: Record<string, any>) => api.get('/device/list', { params }),

  // POST /api/device/register — 注册设备
  register: (data: {
    deviceName: string
    deviceType: string
    firmwareVersion: string
    ipAddress: string
    macAddress: string
  }) => api.post('/device/register', data),

  // GET /api/device/{deviceId}/Data — 设备详情
  getDetail: (deviceId: string) =>
    api.get(`/device/${encodeURIComponent(deviceId)}/Data`),

  // POST /api/device/{deviceId}/delete — 删除设备
  delete: (deviceId: string) =>
    api.post(`/device/${encodeURIComponent(deviceId)}/delete`),
}
