import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'

/**
 * 多端适配统一出口
 *
 * 约定：页面上所有「移动端专属」的**结构判断**都从这里取，不要各页散写 `matchMedia` / `innerWidth`。
 *
 * - `isMobile` 与框架 `body[data-mode]` 同源（见 `store/modules/app/settings.ts#setMode`：
 *   UA 命中移动设备优先，桌面设备按 `width < 1024` 兜底），保证 JS 判断与 UnoCSS `lg:` 断点一致。
 * - `isTablet` 取 CSS 断点 `md(768) ~ lg(1024)`，用于「左右分栏改成上下堆叠」这类平板收紧。
 *
 * 样式能解决的（间距、栅格列数、隐藏/显示）优先用 UnoCSS 的 `lg:` / `md:` 变体；
 * 只有**渲染结构要变**时（表格↔卡片、行内操作收进下拉）才用这里的响应式值。
 *
 * ⚠️ 注意：`mode` 由 `App.vue` 的 `onMounted` 初始化，页面 `setup` 阶段可能还是默认的 `pc`。
 * 所以不要用它算「一次性的初始值」（如 `ref(isMobile ? 'a' : 'b')`），
 * 要用 `computed` 让它跟着模式变化。
 */
export function useResponsive() {
  const appSettingsStore = useAppSettingsStore()
  const breakpoints = useBreakpoints(breakpointsTailwind)

  const isMobile = computed(() => appSettingsStore.mode === 'mobile')
  const isDesktop = computed(() => appSettingsStore.mode === 'pc')
  const isTablet = breakpoints.between('md', 'lg')

  return {
    isMobile,
    isDesktop,
    isTablet,
  }
}
