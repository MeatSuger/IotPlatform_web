<template>
        <div class="login-page">
                <var-card class="login-card" variant="standard" elevation="10" image-width="380px">
                        <router-view />
                </var-card>
        </div>
</template>

<script setup lang="ts">

import axios from 'axios'


</script>

<style scoped>
.login-page {
        position: fixed;
        /* ✅ 确保铺满整个视口 */
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: flex-end;
        /* 右侧居中靠右 */
        align-items: center;
        background: linear-gradient(135deg, #4e54c8, #8d8eab);
        background-size: cover;
        background-position: center;
        padding-right: 10vw;
        box-sizing: border-box;
}

.login-card {
        width: 380px;
        border-radius: 1rem;
}

/*
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
} */

/* 📱 移动端：居中且两侧留白 */
@media (max-width: 768px) {
        .login-page {
                justify-content: center;
                padding: 0 1.5rem;
        }

        .login-card {
                width: 100%;
                max-width: 360px;
                border-radius: 12px;
        }
}
</style>
