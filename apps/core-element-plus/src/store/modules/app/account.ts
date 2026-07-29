import apiApp from '@/api/modules/app'
import router from '@/router'

export const useAppAccountStore = defineStore('appAccount', () => {
  const appSettingsStore = useAppSettingsStore()
  const appTabbarStore = useAppTabbarStore()
  const appRouteStore = useAppRouteStore()
  const appMenuStore = useAppMenuStore()

  // 账号信息
  const token = ref(localStorage.getItem('token') ?? '')
  const account = ref(localStorage.getItem('account') ?? '')
  const role = ref(localStorage.getItem('role') ?? '')
  const email = ref(localStorage.getItem('email') ?? '')

  // 权限信息
  const permissions = ref<string[]>([])

  // 用户完整信息
  const userInfo = ref<{
    id?: number
    name?: string
    account?: string
    roles?: string[]
    email?: string
  }>({})

  // 登录状态
  const isLogin = computed(() => {
    if (token.value) {
      return true
    }
    return false
  })

  // 登录
  async function login(data: {
    account: string
    password: string
  }) {
    // IoT 后端使用 passwd 字段名
    const res = await apiApp.login({
      account: data.account,
      passwd: data.password,
    })
    // IoT 后端返回 { code: 200, data: { tokenValue: "..." } }
    const tokenValue = res.data?.tokenValue || res.data?.data?.tokenValue || ''
    localStorage.setItem('token', tokenValue)
    token.value = tokenValue
    // 获取用户信息
    await getUserInfo()
  }

  // 获取用户信息（含权限）
  async function getUserInfo() {
    try {
      const res = await apiApp.getUserInfo()
      // IoT 后端返回 { code: 200, data: { id, account, name, avatar, roles, permissions } }
      const info = res.data?.user || {}
      localStorage.setItem('account', info.account || '')
      localStorage.setItem('email', info.email || '')
      localStorage.setItem('avatar', info.role || '')
      account.value = info.account || ''
      email.value = info.email || ''
      role.value = info.role || ''
      permissions.value = info.permissions || ['*']
      userInfo.value = {
        id: info.id,
        name: info.name,
        account: info.account,
        email: info.email,
        roles: info.role,
      }
    }
    catch {
      // 用户信息获取失败，可能是 token 过期
    }
  }

  // 手动登出
  function logout(redirect = router.currentRoute.value.fullPath) {
    localStorage.removeItem('token')
    token.value = ''
    router.push({
      name: 'login',
      query: {
        ...(redirect !== appSettingsStore.settings.app.home.fullPath && router.currentRoute.value.name !== 'login' && { redirect }),
      },
    }).then(logoutCleanStatus)
  }

  // 请求登出
  function requestLogout() {
    localStorage.removeItem('token')
    token.value = ''
    router.push({
      name: 'login',
      query: {
        ...(
          router.currentRoute.value.fullPath !== appSettingsStore.settings.app.home.fullPath
          && router.currentRoute.value.name !== 'login'
          && {
            redirect: router.currentRoute.value.fullPath,
          }
        ),
      },
    }).then(logoutCleanStatus)
  }

  // 登出后清除状态
  function logoutCleanStatus() {
    localStorage.removeItem('account')
    localStorage.removeItem('email')
    localStorage.removeItem('avatar')
    account.value = ''
    email.value = ''
    role.value = ''
    permissions.value = []
    userInfo.value = {}
    appSettingsStore.updateSettings({}, true)
    appTabbarStore.clean()
    appRouteStore.removeRoutes()
    appMenuStore.setActived(0)
  }

  // 获取权限（从用户信息中提取，兼容框架调用）
  async function getPermissions() {
    // 如果已有权限信息，直接返回
    if (permissions.value.length > 0) {
      return
    }
    await getUserInfo()
  }

  // 修改密码
  async function editPassword(data: {
    password: string
    newPassword: string
  }) {
    await apiApp.passwordEdit(data)
  }

  return {
    token,
    account,
    role,
    email,
    permissions,
    userInfo,
    isLogin,
    login,
    getUserInfo,
    logout,
    requestLogout,
    getPermissions,
    editPassword,
  }
})
