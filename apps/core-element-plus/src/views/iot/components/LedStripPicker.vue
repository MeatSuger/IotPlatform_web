<script setup lang="ts">
// ==================== Props / 事件 ====================
// modelValue: 当前已选颜色（hex，仅选择态，未下发）；on: 灯珠电源状态；disabled: 指令发送中
const props = withDefaults(
  defineProps<{
    modelValue?: string
    on?: boolean
    disabled?: boolean
  }>(),
  {
    modelValue: '#ff4d4f',
    on: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [hex: string]
  'apply': [hex: string]
  'toggle': [on: boolean]
}>()

// 默认 / 重置颜色（与父级 LED_COLOR_PRESETS[0] 保持一致）
const DEFAULT_HEX = '#ff4d4f'

// 预设色板（参考 /mnt/e/test.html RGB 灯珠控制卡片）
const PRESET_COLORS = [
  '#FF6B6B',
  '#FF9F43',
  '#FECA57',
  '#48DBFB',
  '#0ABDE3',
  '#10AC84',
  '#EE5A24',
  '#5F27CD',
  '#341F97',
  '#FF6FB5',
  '#FF9FF3',
  '#54A0FF',
  '#2ED573',
  '#FF4757',
  '#70A1FF',
  '#DFE6E9',
]

// ==================== 颜色状态（HSL） ====================
const h = ref(0)
const s = ref(100)
const l = ref(50)

{
  const [hh, ss, ll] = hexToHsl(props.modelValue || DEFAULT_HEX)
  h.value = hh
  s.value = ss
  l.value = ll
}

// 父级修改（如点亮时回写）时同步内部状态；内部改动后父级回存的是同一 hex，不会环回
watch(() => props.modelValue, (val) => {
  if (val && val.toLowerCase() !== currentHex().toLowerCase()) {
    const [hh, ss, ll] = hexToHsl(val)
    h.value = hh
    s.value = ss
    l.value = ll
  }
})

// ==================== 颜色转换 ====================
function clampNum(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function hslToRgb(hh: number, ss: number, ll: number): [number, number, number] {
  const hue = hh / 360
  const sat = ss / 100
  const lig = ll / 100
  if (sat === 0) {
    const v = Math.round(lig * 255)
    return [v, v, v]
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t
    if (tt < 0) {
      tt += 1
    }
    if (tt > 1) {
      tt -= 1
    }
    if (tt < 1 / 6) {
      return p + (q - p) * 6 * tt
    }
    if (tt < 1 / 2) {
      return q
    }
    if (tt < 2 / 3) {
      return p + (q - p) * (2 / 3 - tt) * 6
    }
    return p
  }
  const q = lig < 0.5 ? lig * (1 + sat) : lig + sat - lig * sat
  const p = 2 * lig - q
  const r = hue2rgb(p, q, hue + 1 / 3)
  const g = hue2rgb(p, q, hue)
  const b = hue2rgb(p, q, hue - 1 / 3)
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  let hh = 0
  let ss = 0
  const ll = (max + min) / 2
  if (max !== min) {
    const d = max - min
    ss = ll > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rn) {
      hh = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
    }
    else if (max === gn) {
      hh = ((bn - rn) / d + 2) / 6
    }
    else {
      hh = ((rn - gn) / d + 4) / 6
    }
  }
  return [Math.round(hh * 360), Math.round(ss * 100), Math.round(ll * 100)]
}

function hslToHex(hh: number, ss: number, ll: number): string {
  const [r, g, b] = hslToRgb(hh, ss, ll)
  return `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  const full = normalized.length === 3 ? normalized.split('').map(c => `${c}${c}`).join('') : normalized
  const num = parseInt(full, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHsl(r, g, b)
}

function currentHex(): string {
  return hslToHex(h.value, s.value, l.value)
}

function currentRgb(): string {
  const [r, g, b] = hslToRgb(h.value, s.value, l.value)
  return `rgb(${r}, ${g}, ${b})`
}

function currentHslTxt(): string {
  return `hsl(${Math.round(h.value)}, ${Math.round(s.value)}%, ${Math.round(l.value)}%)`
}

// ==================== 状态变更（唯一修改点） ====================
function applyHSL(hh?: number, ss?: number, ll?: number) {
  if (hh != null) {
    h.value = clampNum(hh, 0, 360)
  }
  if (ss != null) {
    s.value = clampNum(ss, 0, 100)
  }
  if (ll != null) {
    l.value = clampNum(ll, 0, 100)
  }
  renderPickers()
  emit('update:modelValue', currentHex())
}

// ==================== 画布渲染 ====================
const svCanvasEl = ref<HTMLCanvasElement | null>(null)
const hueCanvasEl = ref<HTMLCanvasElement | null>(null)
const svWrapEl = ref<HTMLDivElement | null>(null)
const hueWrapEl = ref<HTMLDivElement | null>(null)

// SV 区域底色由色相决定，仅色相变化时重绘双画布，拖取色/滑块时只移动光标
let renderedHue: number | null = null

function renderSV() {
  const canvas = svCanvasEl.value
  if (!canvas) {
    return
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }
  const w = canvas.width
  const ht = canvas.height
  const imageData = ctx.createImageData(w, ht)
  const data = imageData.data
  const hue = Math.round(h.value)
  let idx = 0
  for (let y = 0; y < ht; y++) {
    const lig = 100 - (y / ht) * 100
    for (let x = 0; x < w; x++) {
      const sat = (x / w) * 100
      const [r, g, b] = hslToRgb(hue, sat, lig)
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = 255
      idx += 4
    }
  }
  ctx.putImageData(imageData, 0, 0)
}

function renderHue() {
  const canvas = hueCanvasEl.value
  if (!canvas) {
    return
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }
  const w = canvas.width
  const ht = canvas.height
  const imageData = ctx.createImageData(w, ht)
  const data = imageData.data
  let idx = 0
  for (let y = 0; y < ht; y++) {
    const hue = (y / ht) * 360
    const [r, g, b] = hslToRgb(hue, 100, 50)
    for (let x = 0; x < w; x++) {
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = 255
      idx += 4
    }
  }
  ctx.putImageData(imageData, 0, 0)
}

function renderPickers() {
  const hue = Math.round(h.value)
  if (renderedHue === hue) {
    return
  }
  renderedHue = hue
  renderSV()
  renderHue()
}

// ==================== 色板 / 色相 拖拽取色 ====================
let svDragging = false
let hueDragging = false

function updateSVFromPointer(e: PointerEvent) {
  const rect = svWrapEl.value?.getBoundingClientRect()
  if (!rect || rect.width === 0) {
    return
  }
  const sat = clampNum(((e.clientX - rect.left) / rect.width) * 100, 0, 100)
  const lig = clampNum((1 - (e.clientY - rect.top) / rect.height) * 100, 0, 100)
  applyHSL(undefined, sat, lig)
}

function onSVPointerDown(e: PointerEvent) {
  if (props.disabled) {
    return
  }
  e.preventDefault()
  svDragging = true
  svCanvasEl.value?.setPointerCapture(e.pointerId)
  updateSVFromPointer(e)
}

function onSVPointerMove(e: PointerEvent) {
  if (!svDragging || props.disabled) {
    return
  }
  updateSVFromPointer(e)
}

function onSVPointerUp() {
  svDragging = false
}

function updateHueFromPointer(e: PointerEvent) {
  const rect = hueWrapEl.value?.getBoundingClientRect()
  if (!rect || rect.height === 0) {
    return
  }
  const hue = clampNum(((e.clientY - rect.top) / rect.height) * 360, 0, 360)
  applyHSL(hue)
}

function onHuePointerDown(e: PointerEvent) {
  if (props.disabled) {
    return
  }
  e.preventDefault()
  hueDragging = true
  hueCanvasEl.value?.setPointerCapture(e.pointerId)
  updateHueFromPointer(e)
}

function onHuePointerMove(e: PointerEvent) {
  if (!hueDragging || props.disabled) {
    return
  }
  updateHueFromPointer(e)
}

function onHuePointerUp() {
  hueDragging = false
}

// ==================== HSL 滑块 ====================
function onHueSliderInput(e: Event) {
  applyHSL(Number((e.target as HTMLInputElement).value))
}

function onSatSliderInput(e: Event) {
  applyHSL(undefined, Number((e.target as HTMLInputElement).value))
}

function onLigSliderInput(e: Event) {
  applyHSL(undefined, undefined, Number((e.target as HTMLInputElement).value))
}

// ==================== 预设 / 操作按钮 ====================
function onPresetClick(color: string) {
  const [hh, ss, ll] = hexToHsl(color)
  applyHSL(hh, ss, ll)
}

function onApply() {
  const hex = currentHex()
  emit('apply', hex)
  useFaToast().success(`已应用颜色 ${hex}`)
}

function onRandom() {
  applyHSL(Math.floor(Math.random() * 360), 60 + Math.floor(Math.random() * 40), 40 + Math.floor(Math.random() * 40))
}

function onReset() {
  const [hh, ss, ll] = hexToHsl(DEFAULT_HEX)
  applyHSL(hh, ss, ll)
}

function onToggle(val?: boolean) {
  emit('toggle', val === true)
}

// ==================== 复制 ====================
const copiedChip = ref('')
const copyBtnIcon = ref('i-ri:file-copy-line')

function chipText(key: 'hex' | 'rgb' | 'hsl'): string {
  if (copiedChip.value === key) {
    return '✓ 已复制'
  }
  if (key === 'hex') {
    return currentHex()
  }
  if (key === 'rgb') {
    return currentRgb()
  }
  return currentHslTxt()
}

function copyChip(key: 'hex' | 'rgb' | 'hsl') {
  const text = key === 'hex' ? currentHex() : key === 'rgb' ? currentRgb() : currentHslTxt()
  navigator.clipboard?.writeText(text).then(() => {
    copiedChip.value = key
    useFaToast().success(`${key.toUpperCase()} 已复制`)
    window.setTimeout(() => {
      if (copiedChip.value === key) {
        copiedChip.value = ''
      }
    }, 900)
  }).catch(() => {
    // 剪贴板不可用（如非 HTTPS）时静默失败
  })
}

function onCopy() {
  const hex = currentHex()
  navigator.clipboard?.writeText(hex).then(() => {
    copyBtnIcon.value = 'i-ri:check-line'
    useFaToast().success(`HEX 已复制：${hex}`)
    window.setTimeout(() => {
      copyBtnIcon.value = 'i-ri:file-copy-line'
    }, 1000)
  }).catch(() => {
    // 剪贴板不可用（如非 HTTPS）时静默失败
  })
}

// ==================== 视图绑定 ====================
const previewBg = computed(() => currentHex())

const svCursorStyle = computed(() => ({
  left: `${s.value}%`,
  top: `${100 - l.value}%`,
}))

const hueCursorStyle = computed(() => ({
  top: `${(h.value / 360) * 100}%`,
}))

const hueTrackStyle = computed(() => ({
  '--track': 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
}))

const satTrackStyle = computed(() => ({
  '--track': `linear-gradient(to right, hsl(${Math.round(h.value)} 0% ${Math.round(l.value)}%), hsl(${Math.round(h.value)} 100% ${Math.round(l.value)}%))`,
}))

const ligTrackStyle = computed(() => ({
  '--track': `linear-gradient(to right, hsl(${Math.round(h.value)} ${Math.round(s.value)}% 0%), hsl(${Math.round(h.value)} ${Math.round(s.value)}% 100%))`,
}))

onMounted(() => {
  renderPickers()
})
</script>

<template>
  <div class="led-picker">
    <!-- 头部：标题 + 电源开关 -->
    <div class="header">
      <div class="title">
        <FaIcon name="i-ri:lightbulb-line" class="size-4" />
        <span>灯珠控制</span>
        <FaTag :variant="on ? 'default' : 'secondary'">
          {{ on ? '已点亮' : '已熄灭' }}
        </FaTag>
      </div>
      <FaSwitch
        :model-value="on"
        :disabled="disabled"
        on-icon="i-ri:flashlight-fill"
        off-icon="i-ri:flashlight-line"
        @update:model-value="onToggle"
      />
    </div>

    <!-- 色板 + 预览/滑块 并排 -->
    <div class="main-row">
      <!-- 色相-饱和度/明度 色板 -->
      <div class="picker-area">
        <div ref="svWrapEl" class="sv-wrap">
          <canvas
            ref="svCanvasEl" width="256" height="256"
            @pointerdown="onSVPointerDown" @pointermove="onSVPointerMove"
            @pointerup="onSVPointerUp" @pointercancel="onSVPointerUp"
          />
          <div class="sv-cursor" :style="svCursorStyle" />
        </div>
        <div ref="hueWrapEl" class="hue-wrap">
          <canvas
            ref="hueCanvasEl" width="24" height="256"
            @pointerdown="onHuePointerDown" @pointermove="onHuePointerMove"
            @pointerup="onHuePointerUp" @pointercancel="onHuePointerUp"
          />
          <div class="hue-cursor" :style="hueCursorStyle" />
        </div>
      </div>

      <div class="side-col">
        <!-- 预览 & 数值 -->
        <div class="preview-row">
          <div class="preview-circle" :style="{ background: previewBg }" />
          <div class="color-values">
            <div class="value-row">
              <span class="label">HEX</span>
              <span class="value-chip" title="点击复制" @click="copyChip('hex')">{{ chipText('hex') }}</span>
            </div>
            <div class="value-row">
              <span class="label">RGB</span>
              <span class="value-chip" title="点击复制" @click="copyChip('rgb')">{{ chipText('rgb') }}</span>
            </div>
            <div class="value-row">
              <span class="label">HSL</span>
              <span class="value-chip" title="点击复制" @click="copyChip('hsl')">{{ chipText('hsl') }}</span>
            </div>
          </div>
        </div>

        <!-- HSL 滑块 -->
        <div class="slider-group">
          <div class="slider-item">
            <span class="label">H</span>
            <input
              type="range" min="0" max="360" step="1"
              :value="Math.round(h)" :style="hueTrackStyle" :disabled="disabled"
              @input="onHueSliderInput"
            >
            <span class="value">{{ Math.round(h) }}°</span>
          </div>
          <div class="slider-item">
            <span class="label">S</span>
            <input
              type="range" min="0" max="100" step="1"
              :value="Math.round(s)" :style="satTrackStyle" :disabled="disabled"
              @input="onSatSliderInput"
            >
            <span class="value">{{ Math.round(s) }}%</span>
          </div>
          <div class="slider-item">
            <span class="label">L</span>
            <input
              type="range" min="0" max="100" step="1"
              :value="Math.round(l)" :style="ligTrackStyle" :disabled="disabled"
              @input="onLigSliderInput"
            >
            <span class="value">{{ Math.round(l) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 预设颜色 -->
    <div class="preset-area">
      <div class="preset-label">
        <FaIcon name="i-ri:palette-line" class="size-3.5" />
        预设
      </div>
      <div class="preset-grid">
        <div
          v-for="color in PRESET_COLORS" :key="color"
          class="preset-swatch" :style="{ background: color }"
          :class="{ active: currentHex().toLowerCase() === color.toLowerCase() }"
          @click="onPresetClick(color)"
        />
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="action-row flex flex-wrap gap-2">
      <FaButton variant="default" size="sm" :loading="disabled" @click="onApply">
        <FaIcon name="i-ri:check-line" class="mr-1 size-3.5" />
        应用颜色
      </FaButton>
      <FaButton variant="outline" size="sm" :disabled="disabled" @click="onRandom">
        <FaIcon name="i-ri:shuffle-line" class="mr-1 size-3.5" />
        随机
      </FaButton>
      <FaButton variant="outline" size="icon-sm" :disabled="disabled" title="重置为默认" @click="onReset">
        <FaIcon name="i-ri:reset-left-line" class="size-4" />
      </FaButton>
      <FaButton variant="outline" size="icon-sm" :disabled="disabled" title="复制 HEX" @click="onCopy">
        <FaIcon :name="copyBtnIcon" class="size-4" />
      </FaButton>
    </div>

    <!-- 底部提示 -->
    <div class="footer-hint">
      <span>在色板上拖拽取色，点击「应用颜色」下发灯珠</span>
      <span v-if="disabled" class="flex gap-1 items-center">
        <FaIcon name="i-ri:loader-4-line" class="size-3 animate-spin" />
        发送中…
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.led-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  user-select: none;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  box-shadow: var(--el-box-shadow-lighter);
}

/* ===== 左色板 / 右预览+滑块 并排 ===== */
.main-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.side-col {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

/* ===== 头部 ===== */
.header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.title {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);

  :deep(.fa-icon) {
    color: var(--el-color-primary);
  }
}

/* ===== 预览 & 数值 ===== */
.preview-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.preview-circle {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: 2px solid var(--el-border-color);
  border-radius: 50%;
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
  transition: background 0.15s;
}

.color-values {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.value-row {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;

  .label {
    flex-shrink: 0;
    font-weight: 500;
    color: var(--el-text-color-secondary);
  }
}

.value-chip {
  min-width: 0;
  padding: 1px 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  cursor: pointer;
  background: var(--el-fill-color-lighter);
  border: 1px solid transparent;
  border-radius: 6px;
  transition: background 0.2s, border-color 0.2s;

  &:hover {
    background: var(--el-fill-color-light);
  }

  &:active {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary);
  }
}

/* ===== 色相-饱和度/明度 色板 ===== */
.picker-area {
  display: flex;
  gap: 8px;
}

.sv-wrap {
  position: relative;
  flex-shrink: 0;
  width: 120px;
  height: 120px;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  box-shadow: inset 0 2px 8px rgb(0 0 0 / 6%);

  canvas {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: crosshair;
  }
}

.sv-cursor {
  position: absolute;
  width: 14px;
  height: 14px;
  pointer-events: none;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 25%), 0 2px 8px rgb(0 0 0 / 30%);
  transform: translate(-50%, -50%);
}

.hue-wrap {
  position: relative;
  flex-shrink: 0;
  width: 18px;
  height: 120px;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;

  canvas {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: pointer;
  }
}

.hue-cursor {
  position: absolute;
  right: -3px;
  left: -3px;
  height: 5px;
  pointer-events: none;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 25%), 0 2px 6px rgb(0 0 0 / 30%);
  transform: translateY(-50%);
}

/* ===== HSL 滑块 ===== */
.slider-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.slider-item {
  display: flex;
  gap: 8px;
  align-items: center;

  .label {
    flex-shrink: 0;
    width: 14px;
    font-size: 11px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    text-align: center;
  }

  .value {
    flex-shrink: 0;
    min-width: 34px;
    font-size: 11px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-regular);
    text-align: right;
  }

  input[type="range"] {
    flex: 1;
    height: 5px;
    margin: 0;
    appearance: none;
    outline: none;
    background: var(--track, var(--el-fill-color));
    border-radius: 5px;
    transition: background 0.2s;
  }

  input[type="range"]:disabled {
    opacity: 0.5;
  }

  input[type="range"]::-webkit-slider-thumb {
    width: 14px;
    height: 14px;
    appearance: none;
    cursor: pointer;
    background: #fff;
    border: 2px solid var(--el-color-primary);
    border-radius: 50%;
    box-shadow: 0 1px 4px rgb(0 0 0 / 20%);
    transition: transform 0.2s;

    &:hover {
      transform: scale(1.12);
    }
  }

  input[type="range"]::-moz-range-thumb {
    width: 12px;
    height: 12px;
    cursor: pointer;
    background: #fff;
    border: 2px solid var(--el-color-primary);
    border-radius: 50%;
    box-shadow: 0 1px 4px rgb(0 0 0 / 20%);
  }
}

/* ===== 预设颜色 ===== */
.preset-area {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.preset-label {
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(22px, 1fr));
  gap: 4px;
}

.preset-swatch {
  aspect-ratio: 1 / 1;
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 6px;
  box-shadow: 0 1px 4px rgb(0 0 0 / 10%);
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;

  &:hover {
    z-index: 2;
    border-color: var(--el-color-primary);
    transform: scale(1.08);
  }

  &.active {
    border-color: #fff;
    box-shadow: 0 0 0 2px var(--el-color-primary), 0 4px 12px rgb(0 0 0 / 20%);
  }
}

/* ===== 底部提示 ===== */
.footer-hint {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  color: var(--el-text-color-placeholder);
}

@media (width <= 480px) {
  .main-row {
    flex-direction: column;
    align-items: stretch;
  }

  .sv-wrap {
    width: 100%;
    max-width: 160px;
    height: auto;
    aspect-ratio: 1 / 1;
  }

  .hue-wrap {
    align-self: stretch;
    height: auto;
  }
}
</style>
