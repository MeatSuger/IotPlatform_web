export type ControllerType = 'switch' | 'enum'

export interface ControllerItem {
  id: string
  name: string
  identifier: string
  type: ControllerType
  value: boolean | string
  options?: string[]
}

/**
 * 设备控制器 store
 * 按 deviceId 分组存储控制器列表，持久化到 localStorage（pinia-plugin-persistedstate）
 */
export const useControllerStore = defineStore('controller', () => {
  const controllers = ref<Record<string, ControllerItem[]>>({})

  function getByDevice(deviceId: string): ControllerItem[] {
    return controllers.value[deviceId] || []
  }

  function add(deviceId: string, item: ControllerItem) {
    if (!controllers.value[deviceId]) {
      controllers.value[deviceId] = []
    }
    controllers.value[deviceId].push(item)
  }

  function remove(deviceId: string, id: string) {
    controllers.value[deviceId] = (controllers.value[deviceId] || []).filter(c => c.id !== id)
  }

  return {
    controllers,
    getByDevice,
    add,
    remove,
  }
}, {
  persist: {
    pick: ['controllers'],
  },
})
