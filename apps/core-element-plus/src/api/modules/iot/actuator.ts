import api from '../../index'

// ==================== 执行器定义（物模型，后端 API.md 4.7） ====================
// 与 Sensor 同构：定义仅持久化，经 /actuators/apply 编译进
// DeviceConfig.payload.actuators 后版本化下发；
// id = 设备侧 periph 设备名 = 控制命令 action（≤11 字符）。

// driver：后端兼容标识（后端枚举固定 led/servo/speaker，固件忽略此字段）。
// 设备真实类型由 config.transport 决定（gpio/pwm/spi/led_strip），见固件 docs/mqtt-api.md。
export const actuatorDrivers = ['led', 'servo', 'speaker'] as const

export type ActuatorDriver = (typeof actuatorDrivers)[number]

// ==================== transport（设备类型 / 传输原语） ====================
// 写入类外设按 transport 实例化；固件不做器件语义换算，命令 value 下发传输原语，
// 角度/颜色等语义由云端（前端）换算后发送。
export const actuatorTransports = ['gpio', 'pwm', 'spi', 'led_strip'] as const

export type ActuatorTransport = (typeof actuatorTransports)[number]

export const actuatorTransportLabels: Record<ActuatorTransport, string> = {
  gpio: '数字输出 (gpio)',
  pwm: 'PWM 输出 (pwm)',
  spi: 'SPI 主机写 (spi)',
  led_strip: 'WS2812 灯带 (led_strip)',
}

// transport config 字段定义：驱动执行器表单动态渲染 + 参数校验
export interface TransportConfigField {
  key: string
  label: string
  // number: 数字输入；bool: 开关；select: 下拉
  type: 'number' | 'bool' | 'select'
  options?: Array<{ label: string, value: string }>
  default?: string | boolean | number
  required?: boolean
  unit?: string
  hint?: string
}

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
}

export interface Actuator {
  // 标识符：小写字母开头，仅含小写字母/数字/下划线，≤11（创建必填、不可变）
  id: string
  // 名称（可选，≤100 字符）
  name: string
  // 兼容标识（后端枚举 led/servo/speaker，固件忽略）—— 创建时用户自选
  driver: ActuatorDriver
  // 驱动参数；真实设备类型由 config.transport 表达（gpio/pwm/spi/led_strip）
  config?: Record<string, any>
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
