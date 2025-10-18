<template>

        <h2 class="title">欢迎登录</h2>
        <v-form @submit.prevent="handleLogin" ref="form" class="pa-4" validate-on="blur">
                <v-container class="d-flex flex-column gap-4" max-width="400">
                        <!-- 用户名输入框 -->
                        <v-text-field v-model="userStore.loginData.account" label="用户名" density="compact"
                                variant="outlined" prepend-inner-icon="mdi-account-circle" clearable
                                :rules="[v => !!v || '用户名不能为空']" autocomplete="username" />

                        <!-- 密码输入框 -->
                        <v-text-field v-model="userStore.loginData.passwd" label="密码" prepend-inner-icon="mdi-lock"
                                variant="outlined" density="compact" type="password" clearable
                                :rules="[v => !!v || '密码不能为空']" autocomplete="new-password" />

                        <!-- 登录按钮 -->
                        <v-btn type="submit" color="primary" size="large" block elevation="2">
                                登录
                        </v-btn>

                        <!-- 链接部分 -->
                        <div class="d-flex justify-space-between">
                                <RouterLink to="#">
                                        <v-btn variant="text" color="primary">忘记密码？</v-btn>
                                </RouterLink>

                                <RouterLink to="/auth/resinger">
                                        <v-btn variant="text" color="primary">注册账号</v-btn>
                                </RouterLink>
                        </div>
                </v-container>
        </v-form>
</template>

<script setup lang="ts" name="LoginPage">
import { Snackbar } from '@varlet/ui';
import { useUserStore } from '@/stores/user';
import { useRouter } from 'vue-router'  // ✅ 引入 useRouter

import axios from 'axios';


const router = useRouter()
const userStore = useUserStore();



const handleLogin = async () => {
        if (!userStore.loginData.account || !userStore.loginData.passwd) {
                Snackbar.warning('请输入完整的用户名和密码')
                return
        }

        try {
                // 注意：这里不需要多余的问号 '?'
                const res = await axios.post(
                        '/user/login',       // 后端接口 URL
                        null,                // 因为后端使用 @RequestParam，不接收 JSON
                        {
                                params: {
                                        account: userStore.loginData.account,
                                        passwd: userStore.loginData.passwd,
                                },
                        }
                );

                const data = res.data;

                if (data.tokenValue) {
                        // 保存 token 到 localStorage，便于后续请求使用
                        localStorage.setItem('satoken', data.tokenValue);
                        Snackbar.success(`欢迎回来，${userStore.loginData.account}`);
                        console.log('登录成功:', data);
                        router.push('/MainPage');
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

.d-flex {
        display: flex;
}

.flex-column {
        flex-direction: column;
}

.gap-4 {
        gap: 16px;
}
</style>