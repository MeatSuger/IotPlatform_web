<template>
  <div class="app-main-container">
    <router-view v-slot="{ Component }">
      <!-- 轻量淡入动画，避免 out-in 卡住问题 -->
      <transition name="fade" appear>
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.app-main-container {
  flex: 1;
  overflow: auto;
  padding: 16px;
  background: #f5f7fa;
}

/* 轻量淡入动画：仅透明度变化，减少布局抖动 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
