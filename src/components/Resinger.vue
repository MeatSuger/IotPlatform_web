<!-- <template>

 
        <var-form>
                <var-space direction="column" size="large">
                        <var-input v-model="loginData.account" placeholder="请输入用户名" :rules="[(v) => !!v || '用户名不能为空']">
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
                                <router-link to="/auth/login">
                                        <var-link type="primary" underline="hover">返回</var-link>
                                </router-link>
                        </div>
                </var-space>
        </var-form>
</template> -->
<template>
        <h2 class="title">注册账号</h2>
        <v-form ref="form" @submit.prevent="handleResinger" class="pa-6" validate-on="blur">
                <v-container class="d-flex flex-column">
                        <!-- 用户名 -->
                        <v-text-field v-model="loginData.account" label="用户名" prepend-inner-icon="mdi-account-circle"
                                density="compact" variant="outlined" :rules="[v => !!v || '用户名不能为空']"
                                autocomplete="username" clearable />

                        <!-- 密码 -->
                        <v-text-field v-model="loginData.passwd" label="密码" type="password" density="compact"
                                variant="outlined" prepend-inner-icon="mdi-lock" :rules="[v => !!v || '密码不能为空']"
                                autocomplete="new-password" clearable />

                        <!-- 再次输入密码 -->
                        <v-text-field v-model="loginData.authpasswd" label="确认密码" type="password" density="compact"
                                variant="outlined" prepend-inner-icon="mdi-lock" :rules="[v => !!v || '请再次输入密码']"
                                autocomplete="new-password" clearable />

                        <!-- 注册按钮 -->
                        <v-btn type="submit" color="primary" block size="large" prepend-icon="mdi-account-plus">
                                注册
                        </v-btn>

                        <!-- 返回登录 -->
                        <div class="d-flex justify-end">
                                <RouterLink to="/auth/login">
                                        <v-btn variant="text" color="primary" prepend-icon="mdi-arrow-left">
                                                返回
                                        </v-btn>
                                </RouterLink>
                        </div>
                </v-container>
        </v-form>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { Snackbar } from '@varlet/ui';
import { useUserStore } from '@/stores/user';
import { useRouter } from 'vue-router'  // ✅ 引入 useRouter


import axios from 'axios';
const router = useRouter()
const userStore = useUserStore();
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
                        userStore.setLoginData(loginData.account, loginData.passwd, res.data.tokenValue);
                        // 可以在这里跳转到登录页面或其他页面
                        router.push('/auth/login');
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