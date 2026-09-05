import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import dayjs from 'dayjs'
import { defineConfig, loadEnv } from 'vite'
import { parseLoadedEnv } from 'vite-plugin-env-parse'
import pkg from './package.json' with { type: 'json' }
import createVitePlugins from './vite/plugins.ts'

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = parseLoadedEnv(loadEnv(mode, process.cwd()))
  // 全局 scss 资源
  const scssResources: string[] = []
  fs.readdirSync('src/assets/styles/resources').forEach((dirname) => {
    if (fs.statSync(`src/assets/styles/resources/${dirname}`).isFile()) {
      scssResources.push(`@use "/src/assets/styles/resources/${dirname}" as *;`)
    }
  })
  return {
    // 开发服务器选项 https://cn.vitejs.dev/config/server-options
    server: {
      open: true,
      host: true,
      port: 5173,
      proxy: {
        '/proxy': {
          target: env.VITE_APP_API_BASEURL,
          changeOrigin: command === 'serve' && env.VITE_ENABLE_PROXY,
          rewrite: path => path.replace(/\/proxy/, ''),
        },
      },
    },
    // 构建选项 https://cn.vitejs.dev/config/build-options
    build: {
      outDir: mode === 'production' ? 'dist' : `dist-${mode}`,
      sourcemap: env.VITE_BUILD_SOURCEMAP,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              // Vue 核心生态（框架运行时，几乎每个页面都需要）
              if (id.includes('/vue/') || id.includes('/vue-router/') || id.includes('/pinia/') || id.includes('/vue-demi/') || id.includes('/@vue/')) {
                return 'vue-core'
              }
              // @vueuse 工具库（体积较大，单独分包便于缓存复用）
              if (id.includes('/@vueuse/')) {
                return 'vueuse'
              }
              // 表单验证相关（非首屏必需，按需加载）
              if (id.includes('/vee-validate/') || id.includes('/zod/') || id.includes('/reka-ui/')) {
                return 'vue-libs'
              }
              // Element Plus UI 组件
              if (id.includes('/element-plus/es/components/')) {
                return 'el-ui'
              }
              if (id.includes('/element-plus/') && (
                id.includes('/es/utils/') || id.includes('/es/hooks/') || id.includes('/es/constants/')
                || id.includes('/es/plugin/') || id.includes('/es/locale/') || id.includes('/es/directives/')
              )) {
                return 'el-shared'
              }
              // Element Plus 主题 CSS
              if (id.includes('/element-plus/theme-chalk/')) {
                return 'el-theme'
              }
              // ECharts 按层级拆分：core / chart / component / renderer
              // 各页面只加载自己需要的图表类型和组件
              if (id.includes('/echarts/lib/core') || id.includes('/echarts/lib/animation') || id.includes('/echarts/lib/model') || id.includes('/echarts/lib/data') || id.includes('/echarts/lib/processor') || id.includes('/echarts/lib/coord') || id.includes('/echarts/lib/scale') || id.includes('/echarts/lib/visual') || id.includes('/echarts/lib/label') || id.includes('/echarts/lib/layout') || id.includes('/echarts/lib/legacy') || id.includes('/echarts/lib/preprocessor')) {
                return 'echarts-core'
              }
              if (id.includes('/echarts/lib/chart')) {
                return 'echarts-chart'
              }
              if (id.includes('/echarts/lib/component') || id.includes('/echarts/lib/theme') || id.includes('/echarts/lib/i18n')) {
                return 'echarts-comp'
              }
              if (id.includes('/echarts/lib/renderer') || id.includes('/echarts/lib/loading') || id.includes('/echarts/lib/export')) {
                return 'echarts-renderer'
              }
              if (id.includes('/echarts/lib/echarts.js') || id.includes('/echarts/lib/extension.js')) {
                return 'echarts-core'
              }
              if (id.includes('/zrender/')) {
                return 'zrender'
              }
              // vue-echarts 桥接库
              if (id.includes('/vue-echarts/')) {
                return 'vue-echarts'
              }
              // 小型独立工具库
              if (id.includes('/dayjs/')) {
                return 'dayjs'
              }
              if (id.includes('/axios/')) {
                return 'axios'
              }
              if (id.includes('/lodash/') || id.includes('/lodash-es/')) {
                return 'lodash'
              }
              if (id.includes('/es-toolkit/')) {
                return 'es-toolkit'
              }
              if (id.includes('/pinyin-pro/')) {
                return 'pinyin-pro'
              }
              if (id.includes('/nprogress/')) {
                return 'nprogress'
              }
              if (id.includes('/qs/') || id.includes('/mitt/') || id.includes('/scule/')) {
                return 'utils-sm'
              }
              return 'vendor'
            }
          },
        },
      },
    },
    define: {
      __SYSTEM_INFO__: JSON.stringify({
        pkg: {
          dependencies: pkg.dependencies,
          devDependencies: pkg.devDependencies,
        },
        lastBuildTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      }),
    },
    plugins: createVitePlugins(mode, command === 'build'),
    optimizeDeps: {
      exclude: [
        '@fantastic-admin/components',
        '@fantastic-admin/composables',
      ],
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
        '#': path.resolve(import.meta.dirname, 'src/types'),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: scssResources.join(''),
        },
      },
    },
  }
})
