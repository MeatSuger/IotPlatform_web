<template>
        <div class="login-wrap">
                <h2 class="title">欢迎登录</h2>
                <el-form ref="formRef" :model="userStore.loginData" :rules="rules" label-width="0" @submit.prevent>
                        <el-form-item prop="account">
                                <el-input v-model="userStore.loginData.account" placeholder="用户名" clearable
                                        autocomplete="username" />
                        </el-form-item>
                        <el-form-item prop="passwd">
                                <el-input v-model="userStore.loginData.passwd" placeholder="密码" clearable show-password
                                        autocomplete="current-password" />
                        </el-form-item>
                        <el-form-item>
                                <el-button type="primary" :loading="loading" style="width:100%"
                                        @click="onSubmit">登录</el-button>
                        </el-form-item>
                        <div class="links">
                                <RouterLink to="#">

                                        <el-link type="primary"> 忘记密码？</el-link>

                                </RouterLink>
                                <RouterLink to="/auth/resinger">
                                        <el-link type="primary">注册账号</el-link>

                                </RouterLink>
                        </div>
                </el-form>
        </div>
</template>

<script setup lang="ts" name="LoginPage">
import { ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const formRef = ref<FormInstance>()
const rules = ref<FormRules<typeof userStore.loginData>>({
        account: [{ required: true, message: '用户名不能为空', trigger: 'blur' }],
        passwd: [{ required: true, message: '密码不能为空', trigger: 'blur' }],
})

const onSubmit = () => {
        if (!formRef.value) return
        formRef.value.validate(async (valid) => {
                if (!valid) return
                loading.value = true
                try {
                        const res = await axios.post(
                                '/user/login',
                                null,
                                {
                                        params: {
                                                account: userStore.loginData.account,
                                                passwd: userStore.loginData.passwd,
                                        },
                                }
                        )
                        const data = res.data?.data
                        if (data?.tokenValue) {
                                axios.defaults.headers.common['Authorization'] = `${data.tokenValue}`;
                                localStorage.setItem('satoken', data.tokenValue)
                                ElMessage.success(`欢迎回来，${userStore.loginData.account}`)
                                router.push('/MainPage/dashboard')
                        } else {
                                ElMessage.error('登录失败，请检查用户名和密码')
                        }
                } catch (error: any) {
                        console.error('登录失败:', error)
                        const msg = error?.response?.data?.message || error?.message || '登录请求失败，请稍后重试'
                        ElMessage.error(msg)
                } finally {
                        loading.value = false
                }
        })
}
</script>


<style scoped>
.login-button {
        border-radius: 1rem;
}

.title {

        font-size: 1.8rem;
        text-align: center;
        margin-bottom: 1.5rem;
        margin-top: 1.5rem;
        color: #333;
}

.links {
        display: flex;
        justify-content: space-between;
        font-size: 0.9rem;
        margin-top: 0.5rem;
}

.login-wrap {
        max-width: 400px;
        margin: 0 auto;
        padding: 16px;
}
</style>