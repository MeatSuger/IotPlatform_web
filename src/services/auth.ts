import axios from 'axios'

export interface LoginPayload {
    account: string
    passwd: string
}

export interface LoginData {
    tokenValue?: string
    [key: string]: any
}

export async function login({ account, passwd }: LoginPayload): Promise<LoginData> {
    const res = await axios.post(
        '/user/login',
        null,
        {
            params: { account, passwd },
        }
    )
    const data: LoginData = res.data?.data || {}
    if (!data?.tokenValue) {
        throw new Error('登录失败：未获取到 token')
    }
    const token = data.tokenValue
    // 设置全局请求头
    axios.defaults.headers.common['Authorization'] = `${token}`
    // 持久化（兼容多处读取）
    try {
        localStorage.setItem('satoken', token)
        localStorage.setItem('token', token)
        localStorage.setItem('token_bearer', `Bearer ${token}`)
    } catch { }
    return data
}
export async function resinger(account: string, passwd: string) {
    const res = await axios.post(
        '/user/register',
        {
            account: account,
            passwd: passwd,
        }
    )
    const data = res.data || {}
    return data
}
