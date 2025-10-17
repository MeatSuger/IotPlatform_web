import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import Varlet from '@varlet/ui'
import axios from 'axios'

import '@varlet/ui/es/style'

// axios 全局设置（放在 main.ts 也行）
axios.defaults.withCredentials = true  // ✅ 允许跨域携带 cookie
axios.defaults.baseURL = "http://47.99.74.160:8181/api";
const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(Varlet)

app.mount('#app')
