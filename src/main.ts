import { createApp } from 'vue'
import { createPinia } from 'pinia'


import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import axios from 'axios'
import ElementPlus from 'element-plus'

import 'element-plus/dist/index.css'


// axios 全局设置（放在 main.ts 也行）
axios.defaults.withCredentials = true  // ✅ 允许跨域携带 cookie
// axios.defaults.baseURL = "https://api.meatsuger.top";
axios.defaults.baseURL = "http://47.99.74.160:8181/api";
// axios.defaults.baseURL = "http://localhost:8181/api";
const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.mount('#app')
