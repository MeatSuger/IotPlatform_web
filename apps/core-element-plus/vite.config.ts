import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import dayjs from 'dayjs'
import { defineConfig, loadEnv } from 'vite'
import { parseLoadedEnv } from 'vite-plugin-env-parse'
import pkg from './package.json'
import createVitePlugins from './vite/plugins'

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
              if (id.includes('/vue/') || id.includes('/vue-router/') || id.includes('/pinia/') || id.includes('/vue-demi/') || id.includes('/@vue/')) {
                return 'vue-core'
              }
              if (id.includes('/@vueuse/') || id.includes('/vee-validate/') || id.includes('/zod/') || id.includes('/reka-ui/')) {
                return 'vue-libs'
              }
              if (id.includes('/element-plus/es/utils/') || id.includes('/element-plus/es/hooks/') || id.includes('/element-plus/es/constants/') || id.includes('/element-plus/es/plugin/') || id.includes('/element-plus/es/locale/')) {
                return 'el-shared'
              }
              if (id.includes('/element-plus/theme-chalk/')) {
                return 'el-theme'
              }
              if (id.includes('/echarts/') || id.includes('/zrender/')) {
                return 'echarts'
              }
              if (id.includes('/dayjs/')) {
                return 'dayjs'
              }
              if (id.includes('/axios/')) {
                return 'axios'
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
        '@': path.resolve(__dirname, 'src'),
        '#': path.resolve(__dirname, 'src/types'),
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
