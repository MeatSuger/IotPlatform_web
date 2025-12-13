import { createApp } from 'vue'
import { createPinia } from 'pinia'

import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus'

import 'element-plus/dist/index.css'
import './assets/base.css'


const app = createApp(App)

// 全局错误/未捕获异常的日志输出，便于定位白屏根因
app.config.errorHandler = (err, instance, info) => {
  console.error('[app.errorHandler]', err, info, instance)
}
window.addEventListener('error', (event) => {
  console.error('[window.error]', event.error || event.message, event)
})
window.addEventListener('unhandledrejection', (event) => {
  console.error('[window.unhandledrejection]', event.reason, event)
})

app.use(createPinia())
app.use(router)
app.use(ElementPlus)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.mount('#app')
