import request from '@/utils/request'

export interface LoginPayload {
  account: string
  passwd: string
}

export interface LoginData {
  tokenValue?: string
  [key: string]: any
}

export interface UserInfo {
  id?: number | string
  account?: string
  name?: string
  avatar?: string
  roles?: string[]
  permissions?: string[]
  [key: string]: any
}

/** 登录 */
export async function login({ account, passwd }: LoginPayload): Promise<LoginData> {
  const res = await request.post('/user/login', {
    account,
    passwd,
  })
  const data: LoginData = res.data?.data || {}
  if (!data?.tokenValue) {
    throw new Error('登录失败：未获取到 token')
  }
  return data
}

/** 注册 */
export async function resinger(account: string, passwd: string) {
  const res = await request.post('/user/register', {
    account,
    passwd,
  })
  const data = res.data || {}
  return data
}

/** 获取当前用户信息（校验登录状态） */
export async function getUserInfo(): Promise<UserInfo> {
  const res = await request.get('/user/isLogin')
  const data: UserInfo = res.data?.data || res.data || {}
  // 若后端未返回角色/权限，给一个默认值方便开发调试
  if (!data.roles || data.roles.length === 0) {
    data.roles = data.account === 'admin' ? ['admin'] : ['user']
  }
  if (!data.permissions || data.permissions.length === 0) {
    data.permissions = ['*']
  }
  return data
}
