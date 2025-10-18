import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { md3 } from 'vuetify/blueprints'
// Vuetify


import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import App from './App.vue'
import router from './router'
import Varlet from '@varlet/ui'
import axios from 'axios'

import '@mdi/font/css/materialdesignicons.css'
import '@varlet/ui/es/style'
import 'vuetify/styles'
import 'unfonts.css'



// axios 全局设置（放在 main.ts 也行）
axios.defaults.withCredentials = true  // ✅ 允许跨域携带 cookie
axios.defaults.baseURL = "http://47.99.74.160:8181/api";
const app = createApp(App)
const vuetify = createVuetify({
        components,
        directives,
        blueprint: md3,
})

app.use(createPinia())
app.use(vuetify)
app.use(router)
app.use(Varlet)

app.mount('#app')
