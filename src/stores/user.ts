import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, getUserInfo as getUserInfoApi, type LoginPayload, type UserInfo } from '@/services/auth'
import { setToken, getToken, removeToken } from '@/utils/auth'
import { usePermissionStore } from '@/stores/permission'
import router from '@/router'

export const useUserStore = defineStore('user', () => {
  // ---- state ----
  const token = ref<string>(getToken())
  const userInfo = ref<UserInfo>({})
  const roles = ref<string[]>([])
  const permissions = ref<string[]>([])

  // ---- getters ----
  const hasUserInfo = computed(() => Object.keys(userInfo.value).length > 0)
  const name = computed(() => userInfo.value.name || userInfo.value.account || '用户')
  const avatar = computed(() => userInfo.value.avatar || '')

  // ---- actions ----

  /** 登录：调 API → 存 token → 获取用户信息 */
  async function login(payload: LoginPayload) {
    const data = await loginApi(payload)
    const tokenValue = data.tokenValue ?? ''
    setToken(tokenValue)
    token.value = tokenValue
    // 登录成功后获取用户信息（调用 /isLogin）
    await getUserInfo()
    return data
  }

  /** 获取用户信息（调用 /isLogin） */
  async function getUserInfo() {
    const info = await getUserInfoApi()
    userInfo.value = info
    roles.value = info.roles || []
    permissions.value = info.permissions || []
    return info
  }

  /** 登出：清除 token 和用户信息 */
  async function logout() {
    fedLogOut()
  }

  /** 仅前端登出 */
  function fedLogOut() {
    removeToken()
    token.value = ''
    userInfo.value = {}
    roles.value = []
    permissions.value = []
    const permissionStore = usePermissionStore()
    permissionStore.reset()
    router.replace({ path: '/auth/login' })
  }

  /** 重置全部状态（用于 401 等场景） */
  function resetState() {
    removeToken()
    token.value = ''
    userInfo.value = {}
    roles.value = []
    permissions.value = []
  }

  return {
    // state
    token,
    userInfo,
    roles,
    permissions,
    // getters
    hasUserInfo,
    name,
    avatar,
    // actions
    login,
    getUserInfo,
    logout,
    fedLogOut,
    resetState,
  }
})
