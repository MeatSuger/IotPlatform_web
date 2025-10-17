<template>
        <h2 class="title">注册账号</h2>
        <var-form>
                <var-space direction="column" size="large">
                        <var-input v-model="loginData.account" placeholder="请输入用户名" clearable
                                :rules="[(v) => !!v || '用户名不能为空']">
                                <template #prepend-icon>
                                        <var-icon name="account-circle" />
                                </template>
                        </var-input>

                        <var-input v-model="loginData.passwd" placeholder="请输入密码" type="password" clearable
                                :input-props="{ autocomplete: 'current-password' }" :rules="[(v) => !!v || '密码不能为空']">
                                <template #prepend-icon>
                                        <var-icon name="lock" />
                                </template>
                        </var-input>
                        <var-input v-model="loginData.authpasswd" placeholder="请再次输入密码" type="password" clearable
                                :input-props="{ autocomplete: 'current-password' }" :rules="[(v) => !!v || '密码不能为空']">
                                <template #prepend-icon>
                                        <var-icon name="lock" />
                                </template>
                        </var-input>

                        <var-button class="login-button" block type="primary" size="large" @click="handleResinger"
                                v-ripple="true">
                                登录
                        </var-button>

                        <div class="links">
                                <router-link to="/login">
                                        <var-link type="primary" underline="hover">返回</var-link>
                                </router-link>
                        </div>
                </var-space>
        </var-form>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { Snackbar } from '@varlet/ui';
import axios from 'axios';
import { useRouter } from 'vue-router'  // ✅ 引入 useRouter

const router = useRouter()
const loginData = reactive({
        account: '',
        passwd: '',
        authpasswd: ''
})

const handleResinger = async () => {
        if (loginData.passwd !== loginData.authpasswd) {
                Snackbar.error('两次输入的密码不一致');
                return;
        }
        try {
                // 注意：这里不需要多余的问号 '?'
                const res = await axios.post(
                        '/user/register',       // 后端接口 URL                
                        {
                                headers: {
                                        'Content-Type': 'application/json'
                                },
                                account: loginData.account,
                                passwd: loginData.passwd,
                                withCredentials: true,

                        },

                );


                if (res.status === 200) {
                        // 保存 token 到 localStorage，便于后续请求使用
                        Snackbar.success(`注册成功${loginData.account}`);

                        // 可以在这里跳转到登录页面或其他页面
                        router.push('/login');
                } else {
                        Snackbar.error('登录失败，请检查用户名和密码');
                }
        } catch (error: any) {
                console.error('登录失败:', error);
                const msg = error.response?.data || '登录请求失败，请稍后重试';
                Snackbar.error(msg);
        }
}
</script>
<style scoped></style>