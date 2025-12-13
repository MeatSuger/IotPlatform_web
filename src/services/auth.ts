import request from '@/utils/request'

export interface LoginPayload {
    account: string
    passwd: string
}

export interface LoginData {
    tokenValue?: string
    [key: string]: any
}

export async function login({ account, passwd }: LoginPayload): Promise<LoginData> {
    const res = await request.post(
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
    try {
        localStorage.setItem('satoken', token)
        localStorage.setItem('token', token)
        localStorage.setItem('token_bearer', `Bearer ${token}`)
    } catch { }
    return data
}
export async function resinger(account: string, passwd: string) {
    const res = await request.post(
        '/user/register',
        {
            account: account,
            passwd: passwd,
        }
    )
    const data = res.data || {}
    return data
}
