// ============================================================================
// 手机照片 → 墨水屏四色（BWRY）位图。
//
// 面板：JD79665（华为 A1）768×552，2bpp，4 像素/字节，MSB first；
// 颜色码 0=黑 1=白 2=黄 3=红（与固件 components/periph/src/drivers/epd_driver.c 一致）。
//
// 面板 LUT 固定、只能控制 framebuffer 的 4 色像素值，所以算法只负责决定「原图这个
// 像素该发哪一个四色状态」，走一条针对固定 EPD 的感知量化流水线：
//
//   线性化 / Gamma → OKLab
//   → 白平衡 / 色调映射 / 动态范围压缩
//   → 亮度 + 色度加权的 OKLab 最近色（中性色软惩罚）
//   → Sobel 梯度边缘保护：
//        边缘像素 → 直接最近色量化（不扩散误差，文字 / 线条保持锐利）
//        非边缘   → Stucki 误差扩散（蛇形扫描），传播强度按区域自适应
//   → 2bpp framebuffer（4 像素 / 字节，MSB first，与固件一致）
//
// 算法参考：
//  - paperlesspaper/epdoptimize —— 标定调色板、色调映射、LAB 动态范围压缩、边缘保护
//    https://github.com/paperlesspaper/epdoptimize
//  - ibezkrovnyi/image-quantization (image-q) —— 误差扩散核与色彩距离工程实现
//  - Tanner Helland《Dithering – eleven algorithms》/ Stucki 核系数
//
// 关键取舍：
//  - 调色板用「面板实测外观色」而不是 #FF0000/#FFFF00 原色：LUT 输出是黑盒，
//    量化必须按实际显示色反推（device 码 0/1/2/3 不变）；
//  - 距离用 OKLab 而不是 RGB 欧氏距离（RGB 距离不等于人眼感知距离）；
//  - 误差扩散用 Stucki：比 Floyd–Steinberg 更平滑，四色屏上规则网纹更少；
//  - 误差按区域自适应传播（平坦 0.8 / 渐变 0.6 / 高频 0.3 / 边缘 0）：
//    四色数量太少，100% 传播很容易形成明显纹理；
//  - 抖动的作用是「用四种墨水合成出很多层次」：中性区域用黑白点密度表现灰阶，
//    彩色区域用四色混合表现中间色，高光保持纯白、暗部保持纯黑。
// ============================================================================

export interface EpdPaletteEntry {
  name: string
  /** 标定外观色（0-255）：用于抖动匹配与预览，近似面板实际观感 */
  color: [number, number, number]
  /** 固件 2bpp 颜色码（0=黑 1=白 2=黄 3=红） */
  device: number
}

// e-ink 是反射式显示：白偏灰、黄/红比 sRGB 原色暗。直接用 #FFFFFF/#FFFF00/#FF0000
// 抖动会让中间调偏亮偏艳，因此这里用标定外观色（思路同 epdoptimize 的标定调色板）。
// 有实测条件时（分色仪/色卡拍照取色）改这里即可，device 码不要动。
export const EPD_PALETTE: EpdPaletteEntry[] = [
  { name: 'black', color: [0x14, 0x14, 0x14], device: 0 },
  { name: 'white', color: [0xF2, 0xF2, 0xEE], device: 1 },
  { name: 'yellow', color: [0xEA, 0xCC, 0x1C], device: 2 },
  { name: 'red', color: [0xC2, 0x2A, 0x26], device: 3 },
]

export interface ConvertResult {
  /** 2bpp 打包位图（可直接作为设备位图载荷） */
  packed: Uint8Array
  /** 每像素调色板下标（= device 颜色码，便于预览） */
  idx: Uint8Array
  width: number
  height: number
}

// ============================================================================
// 手机照片专用参数
// ============================================================================

/**
 * 手机照片通常略平、色偏；墨水屏是反射式、对比与饱和都弱。
 * 因此整体提对比 + 提饱和，让颜色尽量落到红/黄/黑/白四色上，
 * 而不是被抖动成一片灰。
 */
const PHOTO = {
  /** 曝光（档）：手机测光偏保守，轻微提亮 0.03EV */
  exposure: 0.03,
  /** 饱和度：1.30（四色屏需要更强的色彩决断力） */
  saturation: 1.3,
  /** 对比度：1.10 */
  contrast: 1.1,
  /** S 曲线强度：0.30（压暗部、提亮部，照片更"通透"） */
  scurve: 0.3,
  /** 高光保护：亮度 ≥ p98.5 且低饱和的像素（白墙/天空/纸）保持纯白 */
  whitePreservePercentile: 0.985,
  whitePreserveMaxChroma: 0.12,
  /** 白平衡强度 0..1（灰世界） */
  whiteBalanceStrength: 0.5,
}

/**
 * 中性色保护：源像素 OKLab chroma 低于此值时，对有彩色调色板项施加惩罚。
 * BWRY 四色缺中性中间调，红/黄的亮度恰好落在中灰附近，不做限制时中灰会被
 * 匹配到红（整片发红）。惩罚是「软」的：纯灰稳定落在黑/白，而皮肤、米色这类
 * 弱彩度仍能保留颜色 —— 抖动因此能表现出更多层次（颜色深度）。
 */
const NEUTRAL_SOURCE_CHROMA = 0.04
/** 调色板项 OKLab chroma 高于此值视为有彩色（参与中性惩罚）。 */
const CHROMATIC_PALETTE_CHROMA = 0.05
/** 最中性像素对有彩色项的惩罚（OKLab 距离平方），需大于「中灰到红」与「中灰到黑/白」的差。 */
const NEUTRAL_CHROMA_PENALTY = 0.18

/**
 * 距离权重：OKLab 的亮度分量略微加权。
 * 四色屏最容易糊掉的是中间调，稍微偏向亮度可以保住明暗层次。
 */
const DIST_W_LUMA = 1.1
const DIST_W_CHROMA = 1.0

/** 边缘阈值（Sobel 幅值，已按 /4 归一化，黑白硬边约 1.0）：超过视为文字 / 线条边缘。 */
const EDGE_GRADIENT = 0.8
/** 自适应误差传播强度：平坦 / 渐变 / 高频（边缘为 0，不传播）。 */
const PROP_FLAT = 0.8
const PROP_MID = 0.6
const PROP_HIGH = 0.3

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
// 预处理：白平衡 → 色调映射 → 动态范围压缩（原地操作 sRGB 0..1 数组）
// ============================================================================

/** 轻度灰世界白平衡：把三通道均值拉向共同均值，消除室内灯光偏色。 */
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

/** 曝光 → 饱和度 → 对比度 → S 曲线。 */
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

/** 直方图百分位（0..1）。 */
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

/**
 * 动态范围压缩：按亮度百分位把画面铺满 [0,1]（保持色相的比例增益），
 * 并把接近最亮的低饱和像素（白墙/天空/纸）钉回纯白，避免高光被压灰。
 */
function applyDynamicRange(rgb: Float32Array): void {
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
    return // 近似纯色或已满量程，无需压缩
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
 * Stucki 核（比 Floyd–Steinberg 更平滑，四色 EPD 上规则网纹更少）：
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

/**
 * Sobel 梯度幅值图（在色调映射后的亮度上算），用于：
 *   1) 边缘保护 —— 强边缘直接量化、不扩散误差（文字 / 线条 / 图标保持锐利）；
 *   2) 自适应传播 —— 平坦区域多传、高频区域少传，避免四色屏出现规则网纹。
 * 幅值按 /4 归一化，黑白硬边约为 1.0。
 */
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

/** 误差扩散（蛇形扫描，误差在线性光空间累积）。 */
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

      // 自适应传播强度：边缘不传播（文字直通），高频弱传播（避免网纹），平坦正常传播
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

      const er = (r - palLin[k][0]) * strength
      const eg = (g - palLin[k][1]) * strength
      const eb = (b - palLin[k][2]) * strength

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

// ============================================================================
// 调色板匹配
// ============================================================================

/**
 * OKLab 最近调色板项（返回下标 = device 颜色码）。
 *
 * @param srcChroma 源像素（未叠加扩散误差）的 OKLab 色度。
 *   中性保护必须按「原图颜色」判定而不是按误差累积后的值：否则误差扩散会把
 *   极小的色偏逐像素放大，累积色度一超过阈值惩罚就失效，中灰会整片偏黄/偏红。
 */
function nearestPalette(
  r: number,
  g: number,
  b: number,
  srcChroma: number,
  palLab: Array<[number, number, number]>,
  palChroma: number[],
): number {
  const [l, a, bb] = linearRgbToOklab(r, g, b)
  const penalty = srcChroma < NEUTRAL_SOURCE_CHROMA
    ? (1 - srcChroma / NEUTRAL_SOURCE_CHROMA) * NEUTRAL_CHROMA_PENALTY
    : 0

  let best = 0
  let bestD = Infinity
  for (let k = 0; k < palLab.length; k++) {
    const p = palLab[k]
    const dl = l - p[0]
    const da = a - p[1]
    const db = bb - p[2]
    let d = DIST_W_LUMA * dl * dl + DIST_W_CHROMA * (da * da + db * db)
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

/** 4 像素/字节，MSB first（与固件 (color << (6 - k*2)) 一致）。 */
function pack2bpp(idx: Uint8Array): Uint8Array {
  const out = new Uint8Array(idx.length / 4)
  for (let i = 0, p = 0; i < idx.length; i += 4, p++) {
    out[p] = (idx[i] << 6) | (idx[i + 1] << 4) | (idx[i + 2] << 2) | idx[i + 3]
  }
  return out
}

// ============================================================================
// 主流程
// ============================================================================

/**
 * 手机照片（已缩放到 EPD 尺寸的 ImageData）→ 2bpp 设备位图。
 * @param src 面板尺寸（768×552）的 RGBA 像素
 */
export function imageDataToPanel(src: ImageData): ConvertResult {
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
  applyDynamicRange(rgb)

  // 3) 线性光（误差扩散空间）+ 源像素色度（中性保护）+ 调色板 OKLab（匹配空间）
  const lin = new Float32Array(n * 3)
  for (let i = 0; i < n * 3; i++) {
    lin[i] = srgbToLinear(rgb[i])
  }
  // 源像素 OKLab 色度：中性保护按原图判定，避免误差累积把色偏放大
  const srcChroma = new Float32Array(n)
  for (let i = 0, p = 0; i < n; i++, p += 3) {
    const lab = linearRgbToOklab(lin[p], lin[p + 1], lin[p + 2])
    srcChroma[i] = Math.hypot(lab[1], lab[2])
  }
  // 调色板色值是 0..255，srgbToLinear 需要 0..1，必须先归一化（漏了会全部匹配到黑）
  const palLin = EPD_PALETTE.map(e => e.color.map(v => srgbToLinear(v / 255)) as [number, number, number])
  const palLab = palLin.map(c => linearRgbToOklab(c[0], c[1], c[2]))
  const palChroma = palLab.map(p => Math.hypot(p[1], p[2]))

  // 4) 梯度图（边缘保护 + 自适应传播）→ Stucki 误差扩散
  const grad = computeGradient(rgb, w, h)
  const idx = new Uint8Array(n)
  diffuse(lin, grad, srcChroma, w, h, idx, palLin, palLab, palChroma)

  return { packed: pack2bpp(idx), idx, width: w, height: h }
}
