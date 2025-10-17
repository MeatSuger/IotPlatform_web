// stores/user.ts
import { defineStore } from 'pinia';
import { reactive } from 'vue';

export const useUserStore = defineStore('user', () => {
        // 使用 reactive 包裹对象
        const loginData = reactive({
                account: '',
                passwd: '',
                saToken: '',
        });

        // 更新账号密码
        const setLoginData = (account: string, passwd: string, saToken: string) => {
                loginData.account = account;
                loginData.passwd = passwd;
                loginData.saToken = saToken;
        };

        return { loginData, setLoginData };
});
