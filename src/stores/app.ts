import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(false)

  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  const setSidebar = (val: boolean) => {
    sidebarCollapsed.value = val
  }

  return { sidebarCollapsed, toggleSidebar, setSidebar }
})
