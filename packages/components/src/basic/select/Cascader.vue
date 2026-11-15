<script setup lang="ts">
import type { AcceptableValue, PopoverContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import type { CascaderOption } from './types'
import { ChevronDown, ChevronRight } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { cn } from '#utils'
import { Popover, PopoverContent, PopoverTrigger } from '../popover/popover'

// 级联选择器：触发器复用 FaSelect 的输入框样式，面板为多列联动列表。
// 交互与 Element Plus Cascader 一致：悬停/点击展开下一列，点击叶子节点完成选择。

defineOptions({
  name: 'BuiltInCascader',
})

const props = withDefaults(defineProps<{
  options: CascaderOption[]
  placeholder?: string
  disabled?: boolean
  separator?: string
  side?: PopoverContentProps['side']
  align?: PopoverContentProps['align']
  sideOffset?: number
  class?: HTMLAttributes['class']
  panelClass?: HTMLAttributes['class']
}>(), {
  placeholder: '请选择',
  disabled: false,
  separator: '/',
  side: 'bottom',
  align: 'start',
  sideOffset: 4,
})

const emits = defineEmits<{
  change: [value: AcceptableValue[]]
}>()

const value = defineModel<AcceptableValue[]>({ default: () => [] })

const open = ref(false)
// 当前展开的祖先链（不含叶子）；列数 = activePath.length + 1
const activePath = ref<AcceptableValue[]>([])

function findOption(options: CascaderOption[], target: AcceptableValue): CascaderOption | undefined {
  return options.find(option => option.value === target)
}

/** 把值路径映射成标签路径，用于触发器展示完整路径 */
function labelsOfPath(options: CascaderOption[], path: AcceptableValue[]): string[] {
  const labels: string[] = []
  let nodes = options
  for (const target of path) {
    const option = findOption(nodes, target)
    if (!option) {
      break
    }
    labels.push(option.label)
    nodes = option.children ?? []
  }
  return labels
}

const selectedLabels = computed(() => labelsOfPath(props.options, value.value ?? []))
// 与截图一致：路径用 " / " 分隔
const displayText = computed(() => selectedLabels.value.join(` ${props.separator} `))

const columns = computed(() => {
  const result: CascaderOption[][] = [props.options]
  let nodes = props.options
  for (const target of activePath.value) {
    const option = findOption(nodes, target)
    if (!option?.children?.length) {
      break
    }
    result.push(option.children)
    nodes = option.children
  }
  return result
})

// 打开时按当前选中值展开到父级，最后一级列中高亮叶子
watch(open, (isOpen) => {
  if (isOpen) {
    activePath.value = (value.value ?? []).slice(0, -1)
  }
})

// 外部值变化时同步展开层级（例如表单回填/程序化赋值）
watch(value, (next) => {
  if (open.value) {
    activePath.value = (next ?? []).slice(0, -1)
  }
})

function pathAt(columnIndex: number): AcceptableValue[] {
  return activePath.value.slice(0, columnIndex)
}

function isExpanded(option: CascaderOption, columnIndex: number): boolean {
  return activePath.value[columnIndex] === option.value
}

function isSelected(option: CascaderOption, columnIndex: number): boolean {
  return (value.value ?? [])[columnIndex] === option.value
}

function onHover(option: CascaderOption, columnIndex: number) {
  if (props.disabled || option.disabled) {
    return
  }
  const parentPath = pathAt(columnIndex)
  // 父节点悬停立即展开；叶子只收起更深列，保持当前层级
  activePath.value = option.children?.length
    ? [...parentPath, option.value]
    : parentPath
}

function onSelect(option: CascaderOption, columnIndex: number) {
  if (props.disabled || option.disabled) {
    return
  }
  const path = [...pathAt(columnIndex), option.value]
  if (option.children?.length) {
    activePath.value = path
    return
  }
  value.value = path
  emits('change', path)
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child :disabled="props.disabled">
      <button
        type="button"
        :disabled="props.disabled"
        :class="
          cn(
            'border-input [&_svg:not([class*=text-])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 h-9',
            props.class,
          )
        "
      >
        <span class="flex gap-2 min-w-0 items-center line-clamp-1">
          <span v-if="displayText" class="truncate">{{ displayText }}</span>
          <span v-else class="text-muted-foreground truncate">{{ props.placeholder }}</span>
        </span>
        <ChevronDown class="opacity-50 shrink-0 size-4" />
      </button>
    </PopoverTrigger>
    <PopoverContent
      :side="props.side"
      :align="props.align"
      :side-offset="props.sideOffset"
      :collision-padding="8"
      :class="cn('z-2000 w-auto min-w-[8rem] overflow-hidden p-0', props.panelClass)"
    >
      <div class="flex max-h-72">
        <div
          v-for="(column, columnIndex) in columns"
          :key="columnIndex"
          class="p-1 overscroll-contain max-h-72 min-w-36 overflow-y-auto"
        >
          <button
            v-for="option in column"
            :key="String(option.value)"
            type="button"
            :disabled="option.disabled"
            class="text-sm px-2 py-1.5 text-left outline-hidden rounded-sm flex gap-2 w-full transition-colors items-center justify-between hover:text-accent-foreground hover:bg-accent disabled:opacity-50 disabled:pointer-events-none"
            :class="[
              isSelected(option, columnIndex) && 'text-primary font-medium',
              isExpanded(option, columnIndex) && 'bg-accent text-accent-foreground',
            ]"
            @mouseenter="onHover(option, columnIndex)"
            @click="onSelect(option, columnIndex)"
          >
            <span class="truncate">{{ option.label }}</span>
            <ChevronRight v-if="option.children?.length" class="opacity-50 shrink-0 size-4" />
          </button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
