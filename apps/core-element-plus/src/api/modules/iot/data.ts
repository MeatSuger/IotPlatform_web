import api from '../../index'

export const dataApi = {
  // 获取设备监测数据列表
  getList: (deviceId: string, params?: Record<string, any>) =>
    api.get(`/data/${encodeURIComponent(deviceId)}/Data/list`, { params }),
}
