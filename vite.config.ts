import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import ViteFonts from 'unplugin-fonts/vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  plugins: [
    vue(),
    // vueDevTools(),
    ViteFonts({
      fontsource: {
        families: [
          {
            name: 'Roboto',
            weights: [100, 300, 400, 500, 700, 900],
            styles: ['normal', 'italic'],
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  }, build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 强制将大型依赖从主包中分离
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'element-ui': ['element-plus', '@element-plus/icons-vue'],
          'utils': ['axios'],

          // 如果还有大型业务模块，也单独分离
          'dashboard-module': [
            '@/layout/index.vue',
            '@/layout/components/Dashboard.vue',
            '@/layout/components/Device/DeviceInfo.vue',
            '@/layout/components/Device/AddDevice.vue'
          ],
          // 将首页相关组件分离
          'home-module': [
            '@/views/LoginPage.vue',
            '@/layout/components/Login.vue'
          ]
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
},
)
