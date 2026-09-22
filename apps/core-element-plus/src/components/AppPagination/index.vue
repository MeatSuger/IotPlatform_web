<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

defineOptions({
  name: 'AppPagination',
})

/**
 * 分页器多端适配包装
 *
 * - 桌面端（>=1024）：原样转发给框架 `FaPagination`，行为/外观与改造前完全一致。
 * - 移动端：`FaPagination` 会渲染 首页/上一页/页码/下一页/末页 + 总条数 + 每页条数 + 跳页，
 *   在 375px 屏下必然横向溢出（约 390px）。这里降级为「总条数 + 上一页 / 页码指示 / 下一页」。
 *
 * 对外契约与 `FaPagination` 保持一致（`v-model:page` / `v-model:size` / `page-change` / `size-change`），
 * 页面侧可以无痛替换标签名。
 */
const props = withDefaults(defineProps<{
  total: number
  sizes?: number[]
  layout?: string
  class?: HTMLAttributes['class']
}>(), {
  sizes: () => [10, 20, 30, 40, 50, 100],
  layout: 'total, sizes, ->, pager, jumper',
})

const emit = defineEmits<{
  pageChange: [page: number]
  sizeChange: [size: number]
}>()

const page = defineModel<number>('page', { required: true })
const size = defineModel<number>('size', { required: true })

const { isMobile } = useResponsive()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / size.value)))

function goto(target: number) {
  if (target < 1 || target > totalPages.value || target === page.value) {
    return
  }
  // 先走 v-model（update:page），再补 pageChange，语义与 FaPagination 一致
  page.value = target
  emit('pageChange', target)
}

function onInnerPageChange(value: number) {
  emit('pageChange', value)
}

function onInnerSizeChange(value: number) {
  emit('sizeChange', value)
}
</script>

<template>
  <FaPagination
    v-if="!isMobile"
    v-model:page="page"
    v-model:size="size"
    :total="total"
    :sizes="sizes"
    :layout="layout"
    @page-change="onInnerPageChange"
    @size-change="onInnerSizeChange"
  />
  <div v-else class="flex flex-wrap gap-2 items-center justify-between">
    <span class="text-sm text-muted-foreground">
      共 {{ total }} 条
    </span>
    <div class="flex gap-1.5 items-center">
      <FaButton
        variant="outline"
        size="icon-sm"
        :disabled="page <= 1"
        @click="goto(page - 1)"
      >
        <FaIcon name="i-ri:arrow-left-s-line" />
      </FaButton>
      <span class="text-sm text-center min-w-14 tabular-nums">
        {{ page }} / {{ totalPages }}
      </span>
      <FaButton
        variant="outline"
        size="icon-sm"
        :disabled="page >= totalPages"
        @click="goto(page + 1)"
      >
        <FaIcon name="i-ri:arrow-right-s-line" />
      </FaButton>
    </div>
  </div>
</template>
