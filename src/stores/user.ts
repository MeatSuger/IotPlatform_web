// stores/user.ts
import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { login as loginApi, type LoginPayload } from '@/services/auth'

const TOKEN_KEY = 'token'

export const useUserStore = defineStore('user', () => {
        const loginData = reactive({
                account: '',
                passwd: '',
                saToken: '',
        })

        const token = ref<string>(localStorage.getItem(TOKEN_KEY) || '')

        const setToken = (val: string) => {
                token.value = val
                loginData.saToken = val
                try {
                        localStorage.setItem(TOKEN_KEY, val)
                } catch { }
        }

        const clearToken = () => {
                token.value = ''
                loginData.saToken = ''
                try {
                        localStorage.removeItem(TOKEN_KEY)
                        localStorage.removeItem('satoken')
                        localStorage.removeItem('token_bearer')
                } catch { }
        }

        const setLoginData = (account: string, passwd: string, saToken: string) => {
                loginData.account = account
                loginData.passwd = passwd
                setToken(saToken)
        }

        const login = async (payload: LoginPayload) => {
                const data = await loginApi(payload)
                setToken(data.tokenValue ?? '')
                return data
        }

        const logout = () => {
                clearToken()
        }

        return { loginData, token, setLoginData, setToken, clearToken, login, logout }
})
