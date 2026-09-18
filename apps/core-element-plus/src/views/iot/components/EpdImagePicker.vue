<script setup lang="ts">
import type { MqttClient } from 'mqtt'
import { Buffer } from 'buffer'
import mqtt from 'mqtt'
import { useAppAccountStore } from '@/store/modules/app/account'
import { EPD_PALETTE, imageDataToPanel } from '@/utils/epdImage'

// ============================================================================
// 墨水屏投图（transport = epd）
//
// 主要输入是「手机拍摄的照片」：选图 → 自动旋转（竖图转 90°，尽量填满横向面板）
// → 高质量缩放 → 白平衡 / 色调映射 / 动态范围压缩 → OKLab 匹配 + Floyd–Steinberg
// 抖动 → 768×552 2bpp 位图 → 经 MQTT over WSS 发布到 iot/{deviceId}/img/*，
// 设备落盘并刷屏。
//
// 转换算法对用户完全隐藏（不出现算法名、无可选项），细节见 utils/epdImage.ts。
//
// 与 Hwawei-epd test.html 的差异：走平台 MQTT 网关（用户 Token 鉴权，不会顶掉设备
// 连接，见 back API.md §6.3）；只保留 MQTT 通道（P2P DataChannel 未移植）；
// UI 用框架内建 Fa* 组件。
// ============================================================================

defineOptions({ name: 'EpdImagePicker' })

const props = withDefaults(defineProps<{
  deviceId: string
  disabled?: boolean
}>(), {
  disabled: false,
})

// ── 面板位图格式（与固件 components/periph/src/drivers/epd_driver.c 一致）──
// 768×552，2bpp BWRY，4 像素/字节，MSB first；颜色码 0=黑 1=白 2=黄 3=红
const EPD_W = 768
const EPD_H = 552
const IMG_CHUNK = 4096 // 须小于固件 MQTT 收包缓冲（8192）

const accountStore = useAppAccountStore()

const canvasEl = ref<HTMLCanvasElement | null>(null)
const fileInputEl = ref<HTMLInputElement | null>(null)

const mqttState = ref<'idle' | 'connecting' | 'connected' | 'error'>('idle')
const sending = ref(false)
const progress = ref('')
const fileName = ref('')
const imageInfo = ref('')
const packed = ref<Uint8Array | null>(null)
const rotation = ref('auto')
const logLines = ref<string[]>([])
// 回执日志默认收起（可选项），需要排查时再展开
const showLog = ref(false)

const rotationOptions = [
  { label: '自动（竖图转 90°）', value: 'auto' },
  { label: '不旋转', value: '0' },
  { label: '顺时针 90°', value: '90' },
  { label: '180°', value: '180' },
  { label: '逆时针 90°', value: '270' },
]

// 当前已解码图片，旋转方式变化时用于重新量化预览
let currentImg: HTMLImageElement | null = null
let client: MqttClient | null = null

const hasImage = computed(() => packed.value !== null)
const mqttLabel = computed(() => {
  switch (mqttState.value) {
    case 'connected': return 'MQTT 已连接'
    case 'connecting': return '连接中…'
    case 'error': return 'MQTT 连接失败'
    default: return 'MQTT 未连接'
  }
})

const topicCtl = computed(() => `iot/${props.deviceId}/img/ctl`)
const topicData = computed(() => `iot/${props.deviceId}/img/data`)
const topicReply = computed(() => `iot/${props.deviceId}/img/reply`)

function pushLog(msg: string) {
  const time = new Date().toLocaleTimeString()
  logLines.value = [`${time} ${msg}`, ...logLines.value].slice(0, 50)
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ==================== MQTT（mqtt.js over WSS，用户身份） ====================
function onMqttMessage(topic: string, payload: Uint8Array) {
  if (topic !== topicReply.value) {
    return
  }
  try {
    const obj = JSON.parse(Buffer.from(payload).toString('utf8'))
    if (obj.type === 'img_shown' || obj.type === 'img_error') {
      progress.value = ''
    }
    pushLog(`回执 ${obj.type}${obj.reason ? `（${obj.reason}）` : ''}${obj.bytes ? ` ${obj.bytes}B` : ''}`)
  }
  catch {
    pushLog('收到非 JSON 回执')
  }
}

// 连接 MQTT 网关（用户身份：?token=<用户token>，网关不会顶掉设备连接，见 back API.md §6.3）
function connectMqtt(): Promise<boolean> {
  if (client?.connected) {
    return Promise.resolve(true)
  }
  if (!props.deviceId) {
    pushLog('缺少 deviceId，无法连接')
    return Promise.resolve(false)
  }
  if (!accountStore.token) {
    pushLog('未登录，无法连接 MQTT')
    return Promise.resolve(false)
  }

  // 丢弃旧连接，避免重复点击累积客户端
  client?.end(true)
  client = null
  mqttState.value = 'connecting'

  const base = import.meta.env.VITE_WSS_URL || 'ws://localhost:9090'
  const url = `${base}/api/ws/mqtt/broker?token=${encodeURIComponent(accountStore.token)}`

  return new Promise<boolean>((resolve) => {
    const c = mqtt.connect(url, {
      clientId: `iot-web-${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      reconnectPeriod: 0, // 断线由用户手动重连，避免鉴权失败时无限重试
      connectTimeout: 10000,
    })
    client = c

    const timer = setTimeout(() => {
      pushLog('MQTT 连接超时')
      mqttState.value = 'error'
      c.end(true)
      if (client === c) {
        client = null
      }
      resolve(false)
    }, 12000)

    c.on('connect', () => {
      clearTimeout(timer)
      mqttState.value = 'connected'
      c.subscribe(topicReply.value, { qos: 0 })
      pushLog(`MQTT 已连接（用户身份），已订阅 ${topicReply.value}`)
      resolve(true)
    })
    c.on('message', onMqttMessage)
    c.on('error', (err) => {
      clearTimeout(timer)
      mqttState.value = 'error'
      pushLog(`MQTT 连接失败：${err.message}`)
      resolve(false)
    })
    c.on('close', () => {
      if (mqttState.value === 'connected') {
        pushLog('MQTT 连接已断开')
      }
      if (mqttState.value !== 'error') {
        mqttState.value = 'idle'
      }
    })
  })
}

// ==================== 图片 → 面板位图（纯函数，逐像素对齐固件） ====================
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // 手机照片常带 EXIF 方向标记，按 EXIF 渲染避免横竖错位
    img.style.imageOrientation = 'from-image'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片解码失败'))
    img.src = URL.createObjectURL(file)
  })
}

/** 面板是横向 768×552；竖图自动顺时针转 90° 以保留最多画面。 */
function resolveRotation(img: HTMLImageElement): { deg: number, why: string } {
  if (rotation.value !== 'auto') {
    return { deg: Number(rotation.value), why: '手动指定' }
  }
  const panel = EPD_W / EPD_H
  const usage = (a: number) => (a > panel ? panel / a : a / panel)
  const asIs = usage(img.width / img.height)
  const rotated = usage(img.height / img.width)
  if (img.height > img.width && rotated > asIs) {
    return { deg: 90, why: `竖图旋转后画面利用率 ${(rotated * 100).toFixed(0)}% > ${(asIs * 100).toFixed(0)}%` }
  }
  return { deg: 0, why: '横图/方图，无需旋转' }
}

/**
 * 手机照片动辄 3000~4000px，一次性大比例缩到 768px 容易走样（锯齿/摩尔纹）。
 * 先等比缩到最长边 ≤ 2048 作为中间源，最终绘制只剩 ≤2.7× 下采样。
 */
function prescalePhoto(img: HTMLImageElement): { src: CanvasImageSource, width: number, height: number } {
  const maxSide = Math.max(img.width, img.height)
  const k = Math.min(1, 2048 / maxSide)
  if (k >= 1) {
    return { src: img, width: img.width, height: img.height }
  }
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(img.width * k))
  c.height = Math.max(1, Math.round(img.height * k))
  const ctx = c.getContext('2d')
  if (ctx === null) {
    return { src: img, width: img.width, height: img.height }
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return { src: c, width: c.width, height: c.height }
}

/** 等比 cover 缩放 + 居中旋转到 768×552，返回面板尺寸的 ImageData。 */
function imageToPanelImageData(img: HTMLImageElement, rotateDeg: number): ImageData {
  const { src, width: sw, height: sh } = prescalePhoto(img)

  const c = document.createElement('canvas')
  c.width = EPD_W
  c.height = EPD_H
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (ctx === null) {
    throw new Error('无法创建画布上下文')
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, EPD_W, EPD_H)

  const rot = (((rotateDeg | 0) % 360) + 360) % 360
  const swap = rot === 90 || rot === 270
  const iw = swap ? sh : sw
  const ih = swap ? sw : sh
  const scale = Math.max(EPD_W / iw, EPD_H / ih)

  // 以面板中心为原点旋转，再居中绘制（90/270 时画布轴也转，始终按图片自身宽高绘制）
  ctx.save()
  ctx.translate(EPD_W / 2, EPD_H / 2)
  ctx.rotate((rot * Math.PI) / 180)
  const dw = sw * scale
  const dh = sh * scale
  ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh)
  ctx.restore()

  return ctx.getImageData(0, 0, EPD_W, EPD_H)
}

function drawPreview(idx: Uint8Array) {
  const c = canvasEl.value
  if (c === null) {
    return
  }
  c.width = EPD_W
  c.height = EPD_H
  const ctx = c.getContext('2d')
  if (ctx === null) {
    return
  }
  const im = ctx.createImageData(EPD_W, EPD_H)
  for (let i = 0; i < idx.length; i++) {
    const col = EPD_PALETTE[idx[i]].color
    im.data[i * 4] = col[0]
    im.data[i * 4 + 1] = col[1]
    im.data[i * 4 + 2] = col[2]
    im.data[i * 4 + 3] = 255
  }
  ctx.putImageData(im, 0, 0)
}

function onRotationChange() {
  if (currentImg !== null) {
    renderFromImage(currentImg)
  }
}

function renderFromImage(img: HTMLImageElement) {
  const rot = resolveRotation(img)
  const imageData = imageToPanelImageData(img, rot.deg)
  // 固定走「手机照片」流水线（算法对用户隐藏，不出现任何算法名）
  const { packed: bytes, idx } = imageDataToPanel(imageData)
  packed.value = bytes
  imageInfo.value = `${EPD_W}×${EPD_H} · 2bpp · ${bytes.length} 字节 · 旋转 ${rot.deg}°`
  drawPreview(idx)
  pushLog(`已生成面板位图 ${bytes.length} 字节（旋转 ${rot.deg}°：${rot.why}）`)
}

// ==================== 交互 ====================
function pickFile() {
  if (props.disabled || sending.value) {
    return
  }
  fileInputEl.value?.click()
}

async function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }
  fileName.value = file.name
  try {
    const img = await loadImage(file)
    currentImg = img
    renderFromImage(img)
  }
  catch (e) {
    pushLog(`图片加载失败：${e instanceof Error ? e.message : String(e)}`)
  }
}

async function sendImage() {
  const bytes = packed.value
  if (bytes === null || sending.value || props.disabled) {
    return
  }
  sending.value = true
  progress.value = '连接 MQTT…'
  try {
    if (!(await connectMqtt())) {
      throw new Error('MQTT 未连接')
    }
    const c = client
    if (c === null) {
      throw new Error('MQTT 未连接')
    }

    c.publish(topicCtl.value, JSON.stringify({
      type: 'img_start',
      name: fileName.value || 'image',
      size: bytes.length,
      kind: 'epd2bpp',
    }))

    for (let off = 0; off < bytes.length; off += IMG_CHUNK) {
      c.publish(topicData.value, Buffer.from(bytes.subarray(off, off + IMG_CHUNK)))
      progress.value = `发送 ${Math.min(off + IMG_CHUNK, bytes.length)} / ${bytes.length} 字节`
      // 轻微节流，避免打满 broker/设备接收队列
      if ((off / IMG_CHUNK) % 8 === 7) {
        await delay(20)
      }
    }

    c.publish(topicCtl.value, JSON.stringify({ type: 'img_end' }))
    progress.value = '已发送，等待设备刷屏回执（整屏刷新约 15s）…'
    pushLog('图片已发送，等待 img_done / img_shown 回执')
  }
  catch (e) {
    progress.value = ''
    pushLog(`发送失败：${e instanceof Error ? e.message : String(e)}`)
  }
  finally {
    sending.value = false
  }
}

// 切换设备时重建话题订阅
watch(() => props.deviceId, () => {
  client?.end(true)
  client = null
  mqttState.value = 'idle'
})

// 旋转方式变化 → 重新量化预览（算法自动选择，无需用户干预）
watch(rotation, onRotationChange)

onBeforeUnmount(() => {
  client?.end(true)
  client = null
})
</script>

<template>
  <div class="epd-picker">
    <!-- 头部：标题 + MQTT 状态 -->
    <div class="header">
      <div class="title">
        <FaIcon name="i-ri:image-line" class="size-4" />
        <span>墨水屏投图</span>
        <FaTag :variant="mqttState === 'connected' ? 'default' : 'secondary'">
          {{ mqttLabel }}
        </FaTag>
      </div>
    </div>

    <!-- 选择图片 + 旋转 -->
    <div class="flex gap-2 items-center">
      <FaButton variant="outline" size="sm" :disabled="disabled || sending" @click="pickFile">
        <FaIcon name="i-ri:upload-2-line" class="mr-1 size-3.5" />
        选择图片
      </FaButton>
      <input ref="fileInputEl" type="file" accept="image/*" class="hidden" @change="onFileChange">
      <FaSelect v-model="rotation" :options="rotationOptions" :disabled="disabled || sending" class="flex-1" />
    </div>

    <!-- 显示区（布局参照 InkSight）：面板铺满宽度并居中；屏幕满宽 + 面板宽高比；图片按 contain 逻辑填满 -->
    <div class="preview-panel">
      <div class="preview-screen">
        <canvas ref="canvasEl" width="768" height="552" class="preview-canvas" />
        <div v-if="!hasImage" class="preview-empty">
          选择图片后在此预览 4 色效果
        </div>
      </div>
    </div>

    <!-- 调色板图例（标定外观色，用于抖动与预览） -->
    <div class="palette-legend">
      <span v-for="entry in EPD_PALETTE" :key="entry.name" class="legend-item">
        <i class="legend-swatch" :style="{ background: `rgb(${entry.color[0]}, ${entry.color[1]}, ${entry.color[2]})` }" />
        {{ entry.name }}
      </span>
    </div>

    <div v-if="imageInfo" class="text-xs text-gray-400">
      {{ imageInfo }}
    </div>

    <!-- 操作栏（参照 InkSight 底部栏）：主动作在左，次动作 ml-auto 靠右 -->
    <div class="flex flex-wrap gap-2 items-center">
      <FaButton variant="default" size="sm" :loading="sending" :disabled="!hasImage || disabled" @click="sendImage">
        <FaIcon v-if="!sending" name="i-ri:send-plane-line" class="mr-1 size-3.5" />
        发送到墨水屏
      </FaButton>
      <FaButton
        v-if="mqttState !== 'connected'" class="ml-auto" variant="outline" size="sm"
        :loading="mqttState === 'connecting'" :disabled="disabled" @click="connectMqtt"
      >
        <FaIcon v-if="mqttState !== 'connecting'" name="i-ri:link" class="mr-1 size-3.5" />
        连接 MQTT
      </FaButton>
    </div>

    <div v-if="progress" class="text-xs text-primary">
      {{ progress }}
    </div>

    <!-- 回执日志：默认收起，作为可选项按需展开 -->
    <FaCollapsible v-model="showLog" class="log-collapsible">
      <template #trigger="{ open }">
        <span class="log-trigger">
          <FaIcon :name="open ? 'i-ri:arrow-down-s-line' : 'i-ri:arrow-right-s-line'" class="size-4" />
          <span>回执日志</span>
          <span v-if="logLines.length" class="text-gray-400">（{{ logLines.length }}）</span>
        </span>
      </template>
      <div class="log-box">
        <div v-if="logLines.length === 0" class="text-gray-400">
          等待操作…
        </div>
        <div v-for="(line, index) in logLines" :key="index" class="log-line">
          {{ line }}
        </div>
      </div>
    </FaCollapsible>

    <div class="footer-hint">
      <span>选图即本地预览；发送 768×552 2bpp 位图，经 MQTT over WSS 下发</span>
      <span v-if="sending" class="flex gap-1 items-center">
        <FaIcon name="i-ri:loader-4-line" class="size-3 animate-spin" />
        发送中…
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.epd-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: min(460px, 92vw);
  max-height: min(80vh, 720px);
  padding: 10px;
  margin-inline: auto;
  overflow-y: auto;

  /* 常驻滚动条槽：选图后日志/信息变高会触发滚动条，若不预留会让满宽预览宽度缩水、尺寸跳动 */
  scrollbar-gutter: stable;
  user-select: none;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  box-shadow: var(--el-box-shadow-lighter);
}

.header .title {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
}

/* 布局参照 InkSight 预览弹窗：面板铺满可用宽度并居中内容 */
.preview-panel {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}

/* 屏幕「固定宽度 + 固定宽高比（= 面板位图 768:552）」：选图前后尺寸完全一致。
   正常卡片宽度下恒为 400px；只有窄屏（可用宽度不足 400px）才按 100% 自适应。 */
.preview-screen {
  position: relative;
  width: min(100%, 400px);
  aspect-ratio: 768 / 552;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}

/* 图片显示逻辑同 object-contain：绝对定位铺满屏幕、保持比例居中 */
.preview-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

.preview-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.palette-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.legend-item {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.legend-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 2px;
}

/* FaCollapsible 触发器是 reka-ui 原生 button，这里重置成一行纯文本标题 */
.log-collapsible :deep([data-slot="collapsible-trigger"]) {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
}

.log-trigger {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.log-box {
  max-height: 72px;
  padding: 6px 8px;
  margin-top: 4px;
  overflow: auto;
  font-family: ui-monospace, sfmono-regular, menlo, monospace;
  font-size: 11px;
  line-height: 1.6;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.log-line {
  word-break: break-all;
  white-space: pre-wrap;
}

.footer-hint {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
</style>
