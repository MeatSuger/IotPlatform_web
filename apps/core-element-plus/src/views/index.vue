<script setup lang="ts">
import { useRouter } from 'vue-router'

const appSettingsStore = useAppSettingsStore()
const router = useRouter()

// 重定向到首页仪表盘
router.replace(appSettingsStore.settings.app.home.fullPath)
</script>

<template>
  <div class="flex h-full w-full items-center justify-center">
    <div class="text-center">
      <div class="i-svg-spinners:90-ring-with-bg text-3xl text-primary" />
      <p class="text-sm text-muted-foreground mt-3">
        正在跳转到仪表盘...
      </p>
    </div>
  </div>
</template>
