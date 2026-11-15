// ============================================================================
// 手机照片 → 墨水屏 2bpp 位图（BW / BWR / BWRY）。
//
// 面板尺寸与色深由调用方（执行器 specs.width/height/color_depth）决定；
// 2bpp，4 像素/字节，MSB first；颜色码 0=黑 1=白 2=黄 3=红。
//
// 流水线：
//   线性化 / Gamma → OKLab
//   → 白平衡 / 色调映射 / 动态范围压缩
//   → HyAB + 色度耦合的 OKLab 最近色（按原图色度做中性软惩罚）
//   → Sobel 梯度边缘保护：
//        边缘像素 → 直接最近色量化（不扩散误差，文字 / 线条保持锐利）
//        非边缘   → Stucki 误差扩散（蛇形扫描），传播强度按区域自适应
//   → 2bpp framebuffer
//
// 算法参考：
//  - paperlesspaper/epdoptimize —— 标定调色板、色调映射、LAB 动态范围压缩、边缘保护
//  - ibezkrovnyi/image-quantization (image-q) —— 误差扩散核与色彩距离工程实现
//  - Tanner Helland《Dithering – eleven algorithms》/ Stucki 核系数
//  - Byonk PITFALLS.md —— 感知空间匹配 / 物理空间扩散；HyAB + chroma coupling
// ============================================================================

export interface EpdPaletteEntry {
  name: string
  /** 标定外观色（0-255）：用于抖动匹配与预览，近似面板实际观感 */
  color: [number, number, number]
  /** 固件 2bpp 颜色码（0=黑 1=白 2=黄 3=红） */
  device: number
}

// e-ink 是反射式显示：白偏灰、黄/红比 sRGB 原色暗。用标定外观色而非原色。
// 有实测条件时改 color 即可，device 码不要动。
export const EPD_PALETTE: EpdPaletteEntry[] = [
  { name: 'black', color: [34, 35, 36], device: 0 },
  { name: 'white', color: [218, 218, 214], device: 1 },
  { name: 'yellow', color: [197, 148, 39], device: 2 },
  { name: 'red', color: [143, 40, 41], device: 3 },
]

/** 2bpp 运输格式下各色深可用的调色板（device 码固定，不随子集变化）。 */
export const EPD_PALETTES: Record<'bw' | 'bwr' | 'bwry', EpdPaletteEntry[]> = {
  bw: [EPD_PALETTE[0], EPD_PALETTE[1]],
  bwr: [EPD_PALETTE[0], EPD_PALETTE[1], EPD_PALETTE[3]],
  bwry: EPD_PALETTE,
}

/** 按执行器 specs.color_depth 取 2bpp 调色板；rgb565/rgb888 不走本流水线。 */
export function epdPaletteForDepth(colorDepth?: string): EpdPaletteEntry[] {
  switch (colorDepth) {
    case 'bw':
      return EPD_PALETTES.bw
    case 'bwr':
      return EPD_PALETTES.bwr
    case 'bwry':
      return EPD_PALETTES.bwry
    default:
      return EPD_PALETTE
  }
}

export interface ConvertResult {
  /** 2bpp 打包位图（可直接作为设备位图载荷） */
  packed: Uint8Array
  /** 每像素调色板下标（= device 颜色码，便于预览） */
  idx: Uint8Array
  width: number
  height: number
}

// ============================================================================
// 参数
// ============================================================================

const PHOTO = {
  exposure: 0.03,
  saturation: 1.05,
  contrast: 1.05,
  scurve: 0.3,
  whitePreservePercentile: 0.985,
  whitePreserveMaxChroma: 0.12,
  whiteBalanceStrength: 0.5,
}

/**
 * 中性色保护：源像素 OKLab chroma 低于此值时，对有彩色调色板项施加软惩罚。
 * BWRY 缺中性中间调，红/黄的亮度恰在中灰附近，不做限制时中灰会整片发红。
 * 判定必须用「原图色度」，不能用误差累积后的值，否则惩罚会逐像素失效。
 */
const NEUTRAL_SOURCE_CHROMA = 0.04
const CHROMATIC_PALETTE_CHROMA = 0.05
/** HyAB 量纲下的中性惩罚，可调 0.03–0.10。 */
const NEUTRAL_CHROMA_PENALTY = 0.06

/** HyAB 权重：亮度项略微加权，保住四色屏最易糊的中间调明暗层次。 */
const DIST_W_LUMA = 1.1
const DIST_W_CHROMA = 1.0

/** 边缘阈值（Sobel 幅值 /4 归一化，黑白硬边约 1.0）。 */
const EDGE_GRADIENT = 0.8
/** 自适应误差传播强度：平坦 / 渐变 / 高频（边缘为 0）。 */
const PROP_FLAT = 0.8
const PROP_MID = 0.6
const PROP_HIGH = 0.3

/** 误差钳制（线性光空间 0..1）：防止色域外反复弹跳产生彩色散斑。 */
const ERROR_CLAMP = 0.12

// ============================================================================
// 颜色空间
// ============================================================================

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

/** 线性 sRGB → OKLab（Björn Ottosson）。 */
function linearRgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ]
}

// ============================================================================
// 预处理：白平衡 → 色调映射 → 动态范围压缩
// ============================================================================

function applyWhiteBalance(rgb: Float32Array): void {
  const pixels = rgb.length / 3
  let sr = 0
  let sg = 0
  let sb = 0
  for (let i = 0; i < rgb.length; i += 3) {
    sr += rgb[i]
    sg += rgb[i + 1]
    sb += rgb[i + 2]
  }
  sr /= pixels
  sg /= pixels
  sb /= pixels
  const gray = (sr + sg + sb) / 3
  if (sr <= 1e-4 || sg <= 1e-4 || sb <= 1e-4) {
    return
  }
  const k = PHOTO.whiteBalanceStrength
  const gr = 1 + (gray / sr - 1) * k
  const gg = 1 + (gray / sg - 1) * k
  const gb = 1 + (gray / sb - 1) * k

  for (let i = 0; i < rgb.length; i += 3) {
    rgb[i] = clamp01(rgb[i] * gr)
    rgb[i + 1] = clamp01(rgb[i + 1] * gg)
    rgb[i + 2] = clamp01(rgb[i + 2] * gb)
  }
}

function applyToneMapping(rgb: Float32Array): void {
  const exp = 2 ** PHOTO.exposure
  for (let i = 0; i < rgb.length; i += 3) {
    let r = rgb[i] * exp
    let g = rgb[i + 1] * exp
    let b = rgb[i + 2] * exp

    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    r = y + (r - y) * PHOTO.saturation
    g = y + (g - y) * PHOTO.saturation
    b = y + (b - y) * PHOTO.saturation

    r = (r - 0.5) * PHOTO.contrast + 0.5
    g = (g - 0.5) * PHOTO.contrast + 0.5
    b = (b - 0.5) * PHOTO.contrast + 0.5

    const s = PHOTO.scurve
    r += (r * r * (3 - 2 * clamp01(r)) - r) * s
    g += (g * g * (3 - 2 * clamp01(g)) - g) * s
    b += (b * b * (3 - 2 * clamp01(b)) - b) * s

    rgb[i] = clamp01(r)
    rgb[i + 1] = clamp01(g)
    rgb[i + 2] = clamp01(b)
  }
}

function percentileFromHistogram(hist: Uint32Array, total: number, frac: number): number {
  const target = Math.max(1, Math.floor(total * frac))
  let acc = 0
  for (let v = 0; v < hist.length; v++) {
    acc += hist[v]
    if (acc >= target) {
      return v / 255
    }
  }
  return 1
}

// 当前主流程默认关闭（见 imageDataToPanel），保留导出供调参时启用。
export function applyDynamicRange(rgb: Float32Array): void {
  const pixels = rgb.length / 3
  const hist = new Uint32Array(256)
  const lum = new Float32Array(pixels)
  for (let i = 0, p = 0; i < pixels; i++, p += 3) {
    const y = 0.2126 * rgb[p] + 0.7152 * rgb[p + 1] + 0.0722 * rgb[p + 2]
    lum[i] = y
    hist[Math.min(255, Math.max(0, Math.round(y * 255)))]++
  }

  const lo = percentileFromHistogram(hist, pixels, 0.01)
  const hi = percentileFromHistogram(hist, pixels, 0.99)
  if (hi - lo < 1 / 32) {
    return
  }
  const scale = 1 / (hi - lo)
  const whiteCut = percentileFromHistogram(hist, pixels, PHOTO.whitePreservePercentile)

  for (let i = 0, p = 0; i < pixels; i++, p += 3) {
    const y = lum[i]

    if (y >= whiteCut) {
      const chroma = Math.max(rgb[p], rgb[p + 1], rgb[p + 2]) - Math.min(rgb[p], rgb[p + 1], rgb[p + 2])
      if (chroma < PHOTO.whitePreserveMaxChroma) {
        rgb[p] = 1
        rgb[p + 1] = 1
        rgb[p + 2] = 1
        continue
      }
    }

    if (y <= 1e-4) {
      rgb[p] = 0
      rgb[p + 1] = 0
      rgb[p + 2] = 0
      continue
    }

    const y2 = clamp01((y - lo) * scale)
    const gain = y2 / y
    rgb[p] = clamp01(rgb[p] * gain)
    rgb[p + 1] = clamp01(rgb[p + 1] * gain)
    rgb[p + 2] = clamp01(rgb[p + 2] * gain)
  }
}

// ============================================================================
// 抖动：Stucki 误差扩散 + 蛇形扫描 + Sobel 边缘保护 + 自适应传播强度
// ============================================================================

interface KernelTap {
  dx: number
  dy: number
  w: number
}

/**
 * Stucki 核：
 *         X   8   4
 *   2   4   8   4   2
 *   1   2   4   2   1   /42
 */
const STUCKI_KERNEL: KernelTap[] = [
  { dx: 1, dy: 0, w: 8 / 42 },
  { dx: 2, dy: 0, w: 4 / 42 },
  { dx: -2, dy: 1, w: 2 / 42 },
  { dx: -1, dy: 1, w: 4 / 42 },
  { dx: 0, dy: 1, w: 8 / 42 },
  { dx: 1, dy: 1, w: 4 / 42 },
  { dx: 2, dy: 1, w: 2 / 42 },
  { dx: -2, dy: 2, w: 1 / 42 },
  { dx: -1, dy: 2, w: 2 / 42 },
  { dx: 0, dy: 2, w: 4 / 42 },
  { dx: 1, dy: 2, w: 2 / 42 },
  { dx: 2, dy: 2, w: 1 / 42 },
]

function computeGradient(rgb: Float32Array, w: number, h: number): Float32Array {
  const lum = new Float32Array(w * h)
  for (let i = 0, p = 0; i < w * h; i++, p += 3) {
    lum[i] = 0.2126 * rgb[p] + 0.7152 * rgb[p + 1] + 0.0722 * rgb[p + 2]
  }

  const grad = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    const row = y * w
    for (let x = 1; x < w - 1; x++) {
      const i = row + x
      const gx = (lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1])
        - (lum[i - w - 1] + 2 * lum[i - 1] + lum[i + w - 1])
      const gy = (lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1])
        - (lum[i - w - 1] + 2 * lum[i - w] + lum[i - w + 1])
      grad[i] = Math.hypot(gx, gy) * 0.25
    }
  }
  return grad
}

/**
 * OKLab 最近调色板项（返回调色板下标，写出时再映射为 device 颜色码）。
 * 距离用 HyAB：|ΔL| + sqrt(Δa²+Δb²)，再对有彩色项叠加中性软惩罚。
 * @param srcChroma 源像素（未叠加扩散误差）的 OKLab 色度。
 */
function nearestPalette(
  r: number,
  g: number,
  b: number,
  srcChroma: number, // 原图未受污染的色度
  palLab: Array<[number, number, number]>,
  palChroma: number[],
): number {
  // 判断原图是否极其接近中性色（灰度）
  const isSourceNeutral = srcChroma < 0.015 // 极低阈值，只拦截纯灰/浅灰/深灰

  const [l, a, bb] = linearRgbToOklab(r, g, b)

  let best = 0
  let bestD = Infinity

  for (let k = 0; k < palLab.length; k++) {
    // 核心逻辑：如果原图是灰色，强行跳过有彩色调色板项（红 / 黄）
    if (isSourceNeutral && palChroma[k] >= CHROMATIC_PALETTE_CHROMA) {
      continue
    }

    const p = palLab[k]
    const dl = Math.abs(l - p[0])
    const da = a - p[1]
    const db = bb - p[2]
    let d = DIST_W_LUMA * dl + DIST_W_CHROMA * Math.sqrt(da * da + db * db)

    // 原有的软惩罚保留，处理那些“带有微弱色彩但接近灰色”的像素
    const penalty = srcChroma < NEUTRAL_SOURCE_CHROMA
      ? (1 - srcChroma / NEUTRAL_SOURCE_CHROMA) * NEUTRAL_CHROMA_PENALTY
      : 0
    if (penalty > 0 && palChroma[k] >= CHROMATIC_PALETTE_CHROMA) {
      d += penalty
    }

    if (d < bestD) {
      bestD = d
      best = k
    }
  }
  return best
}
/** Stucki 蛇形扫描误差扩散（线性光空间累积，边缘保护 + 分段自适应传播）。 */
function diffuse(
  lin: Float32Array,
  grad: Float32Array,
  srcChroma: Float32Array,
  w: number,
  h: number,
  idx: Uint8Array,
  palLin: Array<[number, number, number]>,
  palLab: Array<[number, number, number]>,
  palChroma: number[],
): void {
  for (let y = 0; y < h; y++) {
    const ltr = (y & 1) === 0
    const start = ltr ? 0 : w - 1
    const end = ltr ? w : -1
    const step = ltr ? 1 : -1

    for (let x = start; x !== end; x += step) {
      const i = y * w + x
      const p = i * 3
      const r = lin[p]
      const g = lin[p + 1]
      const b = lin[p + 2]

      const k = nearestPalette(r, g, b, srcChroma[i], palLab, palChroma)
      idx[i] = k

      const gmag = grad[i]
      let strength: number
      if (gmag >= EDGE_GRADIENT) {
        strength = 0
      }
      else if (gmag >= 0.45) {
        strength = PROP_HIGH
      }
      else if (gmag >= 0.18) {
        strength = PROP_MID
      }
      else {
        strength = PROP_FLAT
      }
      if (strength === 0) {
        continue
      }

      // 误差钳制后再按强度缩放
      let er = r - palLin[k][0]
      let eg = g - palLin[k][1]
      let eb = b - palLin[k][2]
      er = Math.max(-ERROR_CLAMP, Math.min(ERROR_CLAMP, er))
      eg = Math.max(-ERROR_CLAMP, Math.min(ERROR_CLAMP, eg))
      eb = Math.max(-ERROR_CLAMP, Math.min(ERROR_CLAMP, eb))
      er *= strength
      eg *= strength
      eb *= strength
      er *= strength
      eg *= strength
      eb *= strength

      for (let t = 0; t < STUCKI_KERNEL.length; t++) {
        const tap = STUCKI_KERNEL[t]
        const nx = x + (ltr ? tap.dx : -tap.dx)
        const ny = y + tap.dy
        if (nx < 0 || nx >= w || ny >= h) {
          continue
        }
        const q = (ny * w + nx) * 3
        lin[q] += er * tap.w
        lin[q + 1] += eg * tap.w
        lin[q + 2] += eb * tap.w
      }
    }
  }
}

/** 4 像素/字节，MSB first；idx 为调色板下标，写出时映射回固件 device 颜色码。 */
function pack2bpp(idx: Uint8Array, palette: EpdPaletteEntry[]): Uint8Array {
  const out = new Uint8Array(idx.length / 4)
  for (let i = 0, p = 0; i < idx.length; i += 4, p++) {
    out[p] = ((palette[idx[i]]?.device ?? idx[i]) << 6)
      | ((palette[idx[i + 1]]?.device ?? idx[i + 1]) << 4)
      | ((palette[idx[i + 2]]?.device ?? idx[i + 2]) << 2)
      | (palette[idx[i + 3]]?.device ?? idx[i + 3])
  }
  return out
}

// ============================================================================
// 主流程
// ============================================================================

/**
 * 手机照片（已缩放到 EPD 尺寸的 ImageData）→ 2bpp 设备位图。
 * @param src 面板尺寸的 RGBA 像素
 * @param palette 面板色深对应的调色板（默认四色 BWRY）
 */
export function imageDataToPanel(src: ImageData, palette: EpdPaletteEntry[] = EPD_PALETTE): ConvertResult {
  const { width: w, height: h, data } = src
  const n = w * h

  // 1) sRGB(0..1)
  const rgb = new Float32Array(n * 3)
  for (let i = 0, p = 0; i < n; i++, p += 3) {
    rgb[p] = data[i * 4] / 255
    rgb[p + 1] = data[i * 4 + 1] / 255
    rgb[p + 2] = data[i * 4 + 2] / 255
  }

  // 2) 白平衡 → 色调映射 → 动态范围压缩
  applyWhiteBalance(rgb)
  applyToneMapping(rgb)
  // applyDynamicRange(rgb)

  // 3) 线性光 + 原图色度（中性保护按原图判定）
  const lin = new Float32Array(n * 3)
  for (let i = 0; i < n * 3; i++) {
    lin[i] = srgbToLinear(rgb[i])
  }

  const srcChroma = new Float32Array(n)
  for (let i = 0, p = 0; i < n; i++, p += 3) {
    const lab = linearRgbToOklab(lin[p], lin[p + 1], lin[p + 2])
    srcChroma[i] = Math.hypot(lab[1], lab[2])
  }

  // 调色板（色值 0..255 → 先归一化再线性化）
  const palLin: Array<[number, number, number]> = palette.map(
    e => e.color.map(v => srgbToLinear(v / 255)) as [number, number, number],
  )
  const palLab: Array<[number, number, number]> = palLin.map(
    c => linearRgbToOklab(c[0], c[1], c[2]),
  )
  const palChroma = palLab.map(p => Math.hypot(p[1], p[2]))

  // 4) 梯度图 + Stucki 误差扩散
  const grad = computeGradient(rgb, w, h)
  const idx = new Uint8Array(n)
  diffuse(lin, grad, srcChroma, w, h, idx, palLin, palLab, palChroma)

  return { packed: pack2bpp(idx, palette), idx, width: w, height: h }
}
