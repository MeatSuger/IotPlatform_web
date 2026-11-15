import api from '../../index'

// ==================== 执行器定义（物模型，后端 API.md 4.7） ====================
// 与 Sensor 同构：定义仅持久化，经 /actuators/apply 编译进
// DeviceConfig.payload.actuators 后版本化下发；
// id = 设备侧 periph 设备名 = 控制命令 action（≤11 字符）。

// driver：后端兼容标识（后端枚举固定 led/servo/speaker，固件忽略此字段）。
// 设备真实类型由 specs.transport 决定（gpio/pwm/spi/led_strip），见固件 docs/mqtt-api.md。
export const actuatorDrivers = ['led', 'servo', 'speaker'] as const

export type ActuatorDriver = (typeof actuatorDrivers)[number]

// ==================== transport（设备类型 / 传输原语） ====================
// 写入类外设按 transport 实例化；固件不做器件语义换算，命令 value 下发传输原语，
// 角度/颜色等语义由云端（前端）换算后发送。
// epd = 板载墨水屏（JD79665）：不经命令原语传图（106KB 位图），
// 由前端经 MQTT over WSS 直接向 iot/{deviceId}/img/* 发布，见 EpdImagePicker.vue。
export const actuatorTransports = ['gpio', 'pwm', 'spi', 'led_strip', 'epd'] as const

export type ActuatorTransport = (typeof actuatorTransports)[number]

export const actuatorTransportLabels: Record<ActuatorTransport, string> = {
  gpio: '数字输出 (gpio)',
  pwm: 'PWM 输出 (pwm)',
  spi: 'SPI 主机写 (spi)',
  led_strip: 'WS2812 灯带 (led_strip)',
  epd: '墨水屏投图 (epd)',
}

// transport config 字段定义：驱动执行器表单动态渲染 + 参数校验
export interface TransportConfigField {
  key: string
  label: string
  // number: 数字输入；bool: 开关；select: 下拉；text: 文本输入
  type: 'number' | 'bool' | 'select' | 'text'
  options?: Array<{ label: string, value: string }>
  default?: string | boolean | number
  required?: boolean
  unit?: string
  hint?: string
  // true = 收进「高级选项」折叠区（低频/面板硬件相关参数）
  advanced?: boolean
}

// ==================== EPD（墨水屏）显示配置 ====================
// specs.transport=epd 时后端校验：width/height（像素，宽为 8 的倍数）、
// chip（显示控制器型号）、color_depth（色深/配色）。
export const epdColorDepths = ['bw', 'bwr', 'bwry', 'rgb565', 'rgb888'] as const

export type EpdColorDepth = (typeof epdColorDepths)[number]

export const epdColorDepthLabels: Record<EpdColorDepth, string> = {
  bw: '黑白（1bpp）',
  bwr: '三色：黑白红',
  bwry: '四色：黑白红黄（2bpp）',
  rgb565: 'RGB565（16 位）',
  rgb888: 'RGB888（24 位）',
}

// 常见面板预设：选择已知芯片时表单自动带出屏幕尺寸/分辨率与默认色深
export const epdChipPresets: Record<string, { label: string, sizeInch: number, width: number, height: number, colorDepth: EpdColorDepth }> = {
  ssd1683: { label: 'SSD1683 4.2" BWR', sizeInch: 4.2, width: 400, height: 300, colorDepth: 'bwr' },
  jd79665: { label: 'JD79665 7.5" BWRY', sizeInch: 7.5, width: 768, height: 552, colorDepth: 'bwry' },
}

// 屏幕尺寸下拉预设：0.96" ~ 7.5" 通用嵌入式面板（OLED/LCD/EPD）
// 每个选项 = 英寸 + 物理分辨率；选中后把 size_inch/width/height 一起写入 specs
export interface EpdScreenPreset {
  key: string
  inch: number
  width: number
  height: number
  label: string
}

const epdScreenPresetDefs: Array<Omit<EpdScreenPreset, 'key'>> = [
  { inch: 0.96, width: 128, height: 64, label: '0.96 英寸 · 128×64 · OLED' },
  { inch: 1.28, width: 240, height: 240, label: '1.28 英寸 · 240×240 · IPS' },
  { inch: 1.3, width: 240, height: 240, label: '1.3 英寸 · 240×240 · IPS' },
  { inch: 1.54, width: 240, height: 240, label: '1.54 英寸 · 240×240 · IPS' },
  { inch: 1.54, width: 152, height: 152, label: '1.54 英寸 · 152×152 · EPD' },
  { inch: 1.54, width: 200, height: 200, label: '1.54 英寸 · 200×200 · EPD 四色' },
  { inch: 1.69, width: 240, height: 280, label: '1.69 英寸 · 240×280 · IPS' },
  { inch: 1.8, width: 128, height: 160, label: '1.8 英寸 · 128×160 · TFT' },
  { inch: 2.0, width: 240, height: 320, label: '2.0 英寸 · 240×320 · IPS' },
  { inch: 2.4, width: 320, height: 240, label: '2.4 英寸 · 320×240 · TFT' },
  { inch: 2.66, width: 296, height: 152, label: '2.66 英寸 · 296×152 · EPD' },
  { inch: 2.7, width: 176, height: 264, label: '2.7 英寸 · 176×264 · EPD' },
  { inch: 2.8, width: 320, height: 240, label: '2.8 英寸 · 320×240 · TFT' },
  { inch: 2.9, width: 296, height: 128, label: '2.9 英寸 · 296×128 · EPD' },
  { inch: 3.0, width: 400, height: 168, label: '3.0 英寸 · 400×168 · EPD 条屏' },
  { inch: 3.2, width: 320, height: 240, label: '3.2 英寸 · 320×240 · TFT' },
  { inch: 3.5, width: 320, height: 480, label: '3.5 英寸 · 320×480 · TFT' },
  { inch: 3.7, width: 480, height: 280, label: '3.7 英寸 · 480×280 · EPD' },
  { inch: 3.89, width: 768, height: 552, label: '3.89 英寸 · 768×552 · EPD 四色' },
  { inch: 4.0, width: 320, height: 480, label: '4.0 英寸 · 320×480 · TFT' },
  { inch: 4.0, width: 480, height: 800, label: '4.0 英寸 · 480×800 · IPS' },
  { inch: 4.2, width: 400, height: 300, label: '4.2 英寸 · 400×300 · EPD 三色' },
  { inch: 5.0, width: 800, height: 480, label: '5.0 英寸 · 800×480 · IPS' },
  { inch: 5.83, width: 648, height: 480, label: '5.83 英寸 · 648×480 · EPD' },
  { inch: 7.0, width: 1024, height: 600, label: '7.0 英寸 · 1024×600 · IPS' },
  { inch: 7.5, width: 640, height: 384, label: '7.5 英寸 · 640×384 · EPD 四色' },
  { inch: 7.5, width: 768, height: 552, label: '7.5 英寸 · 768×552 · EPD 四色' },
  { inch: 7.5, width: 800, height: 480, label: '7.5 英寸 · 800×480 · EPD' },
]

export const epdScreenPresets: EpdScreenPreset[] = epdScreenPresetDefs.map(preset => ({
  ...preset,
  key: `${preset.inch}-${preset.width}x${preset.height}`,
}))

export const ACTUATOR_TRANSPORT_FIELDS: Record<ActuatorTransport, TransportConfigField[]> = {
  gpio: [
    { key: 'pin', label: 'GPIO 引脚', type: 'number', required: true, hint: '必填' },
    { key: 'active_high', label: '高电平有效', type: 'bool', default: true, hint: '逻辑 1 对应物理高电平' },
    { key: 'initial', label: '初始电平', type: 'select', options: [{ label: '低 (0)', value: '0' }, { label: '高 (1)', value: '1' }], default: '0' },
  ],
  pwm: [
    { key: 'pin', label: 'GPIO 引脚', type: 'number', required: true, hint: '必填（LEDC 通道自动分配）' },
    { key: 'freq_hz', label: '频率 (Hz)', type: 'number', default: '1000', unit: 'Hz' },
  ],
  spi: [
    { key: 'clk', label: 'CLK 引脚', type: 'number', required: true, hint: '必填' },
    { key: 'mosi', label: 'MOSI 引脚', type: 'number', required: true, hint: '必填' },
    { key: 'miso', label: 'MISO 引脚', type: 'number', hint: '写类可留空' },
    { key: 'cs', label: 'CS 引脚', type: 'number', required: true, hint: '必填' },
    { key: 'freq_hz', label: '总线频率 (Hz)', type: 'number', default: '1000000', unit: 'Hz' },
    { key: 'mode', label: 'SPI 模式', type: 'select', options: [
      { label: '模式 0', value: '0' },
      { label: '模式 1', value: '1' },
      { label: '模式 2', value: '2' },
      { label: '模式 3', value: '3' },
    ], default: '0' },
  ],
  led_strip: [
    { key: 'gpio', label: '数据引脚', type: 'number', default: '48' },
    { key: 'count', label: 'LED 数量', type: 'number', default: '1' },
  ],
  // 墨水屏：显示参数随定义下发（图片经 MQTT 直发，见 EpdImagePicker.vue）
  // 基础区只留色深；显示大小（宽高）与显示芯片属面板硬件参数，收进高级选项
  epd: [
    { key: 'color_depth', label: '色深 / 配色', type: 'select', required: true, default: 'bwr', options: epdColorDepths.map(value => ({ label: epdColorDepthLabels[value], value })) },
    // size_inch 由基础区「屏幕尺寸」下拉写入；自定义尺寸时也可在此直接改
    { key: 'size_inch', label: '屏幕尺寸（自定义）', type: 'number', required: true, default: '4.2', unit: '英寸', advanced: true },
    { key: 'chip', label: '显示芯片', type: 'text', required: true, default: 'ssd1683', hint: '如 ssd1683 / jd79665', advanced: true },
    { key: 'width', label: '显示宽度', type: 'number', required: true, default: '400', unit: 'px', hint: '8 的倍数', advanced: true },
    { key: 'height', label: '显示高度', type: 'number', required: true, default: '300', unit: 'px', advanced: true },
  ],
}

export interface Actuator {
  // 标识符：小写字母开头，仅含小写字母/数字/下划线，≤11（创建必填、不可变）
  id: string
  // 名称（可选，≤100 字符）
  name: string
  // 兼容标识（后端枚举 led/servo/speaker，固件忽略）—— 创建时用户自选
  driver: ActuatorDriver
  // 驱动参数 specs（后端 2026 命名统一：原 config 改名，与 Sensor 定义体同名）；
  // 真实设备类型由 specs.transport 表达（gpio/pwm/spi/led_strip/epd）
  specs?: Record<string, any>
  // 是否启用（false = 期望设备卸载该执行器）
  enabled?: boolean
  createdAt?: string
  updatedAt?: string
}

export type ActuatorCreatePayload = Pick<Actuator, 'id' | 'driver'> & Partial<Omit<Actuator, 'id' | 'driver' | 'createdAt' | 'updatedAt'>>

export type ActuatorUpdatePayload = Partial<Omit<Actuator, 'id' | 'createdAt' | 'updatedAt'>>

export const actuatorApi = {
  // GET /api/devices/{deviceId}/actuators — 执行器定义列表
  getList: (deviceId: string) =>
    api.get(`/devices/${encodeURIComponent(deviceId)}/actuators`),

  // GET /api/devices/{deviceId}/actuators/{actuatorId} — 查询单个定义
  get: (deviceId: string, actuatorId: string) =>
    api.get(`/devices/${encodeURIComponent(deviceId)}/actuators/${encodeURIComponent(actuatorId)}`),

  // POST /api/devices/{deviceId}/actuators — 创建执行器定义（仅持久化，下发由 Apply 触发）
  create: (deviceId: string, data: ActuatorCreatePayload) =>
    api.post(`/devices/${encodeURIComponent(deviceId)}/actuators`, data),

  // POST /api/devices/{deviceId}/actuators/{actuatorId}/update — 增量更新执行器定义
  update: (deviceId: string, actuatorId: string, data: ActuatorUpdatePayload) =>
    api.post(`/devices/${encodeURIComponent(deviceId)}/actuators/${encodeURIComponent(actuatorId)}/update`, data),

  // POST /api/devices/{deviceId}/actuators/{actuatorId}/delete — 删除执行器定义
  remove: (deviceId: string, actuatorId: string) =>
    api.post(`/devices/${encodeURIComponent(deviceId)}/actuators/${encodeURIComponent(actuatorId)}/delete`),

  // POST /api/devices/{deviceId}/actuators/apply — 下发执行器配置（编译全部定义进 config 并版本化下发）
  apply: (deviceId: string) =>
    api.post(`/devices/${encodeURIComponent(deviceId)}/actuators/apply`),
}
