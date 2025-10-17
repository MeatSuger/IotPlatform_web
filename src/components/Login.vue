<template>


        <h2 class="title">欢迎登录</h2>
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

                        <var-button class="login-button" block type="primary" size="large" @click="handleLogin"
                                v-ripple="true">
                                登录
                        </var-button>

                        <div class="links">
                                <router-link to="#">
                                        <var-link type="primary" underline="hover">忘记密码？</var-link>
                                </router-link>
                                <router-link to="/resinger">
                                        <var-link type="primary" underline="hover">注册账号</var-link>
                                </router-link>
                        </div>
                </var-space>
        </var-form>

</template>

<script setup lang="ts" name="LoginPage">
import { reactive, readonly, ref } from 'vue';
import { Snackbar } from '@varlet/ui';
import axios from 'axios';
const loginData = reactive({
        account: '',
        passwd: ''
})

const handleLogin = async () => {
        if (!loginData.account || !loginData.passwd) {
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
                                        account: loginData.account,
                                        passwd: loginData.passwd,
                                },
                        }
                );

                const data = res.data;

                if (data.tokenValue) {
                        // 保存 token 到 localStorage，便于后续请求使用
                        localStorage.setItem('satoken', data.tokenValue);
                        Snackbar.success(`欢迎回来，${loginData.account}`);
                        console.log('登录成功:', data);
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
.login-card {
        width: 380px;
        border-radius: 1rem;
}

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

.login-form {
        width: 100%;
}

.links {
        display: flex;
        justify-content: space-between;
        font-size: 0.9rem;
        margin-top: 0.5rem;
}
</style>