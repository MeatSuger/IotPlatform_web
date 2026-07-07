import api from '../../index'

export const deviceApi = {
  // 获取设备列表
  list: (params?: Record<string, any>) => api.get('/device/list', { params }),

  // 注册设备
  register: (data: {
    deviceName: string
    deviceType: string
    firmwareVersion: string
    ipAddress: string
    macAddress: string
  }) => api.post('/device/register', data),
}
