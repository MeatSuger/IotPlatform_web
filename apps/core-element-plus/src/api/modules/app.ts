import api from '../index'

export default {
  // 后端获取路由数据（前端路由模式下不需要）
  routeList: () => api.get('/app/route/list'),

  // 登录
  login: (data: {
    account: string
    passwd: string
  }) => api.post('/users/login', data),

  // 注册
  register: (data: {
    account: string
    passwd: string
  }) => api.post('/users', data),

  // 获取用户信息（含权限）
  getUserInfo: () => api.get('/users/isLogin'),

  // 修改密码
  passwordEdit: (data: {
    password: string
    newPassword: string
  }) => api.post('/user/password/edit', data),
}
