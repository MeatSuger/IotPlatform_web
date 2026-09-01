import { useAppAccountStore } from '@/store/modules/app/account'

export interface WsControlPayload {
  GPIO: string
  action: 'on' | 'off' | 'toggle'
}

export interface WsControlMessage {
  deviceId: string
  type: 'control'
  payload: WsControlPayload
}

export interface WsResponseMessage {
  deviceId: string
  type: 'control' | 'status' | 'auth' | 'deviceOnline' | 'deviceOffline'
  payload?: Record<string, any>
  status?: string
  message?: string
  timestamp?: string
}

/** WebSocket 鉴权失败错误码（服务端关闭码） */
const WS_AUTH_ERROR_CODES = [4001, 4002, 4003, 4401]

export function useDeviceWebSocket() {
  const ws = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const lastResponse = ref<WsResponseMessage | null>(null)
  const lastError = ref<string | null>(null)

  // 待发送消息队列（断线重连后重发）
  const pendingMessages: WsControlMessage[] = []

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 5
  const reconnectBaseDelay = 2000

  function getWsUrl(): string {
    const base = import.meta.env.VITE_WSS_URL || 'ws://localhost:9090'
    const appAccountStore = useAppAccountStore()
    const token = appAccountStore.token
    if (token) {
      return `${base}/api/ws/user?token=${encodeURIComponent(token)}`
    }
    return `${base}/api/ws/user`
  }

  function connect(deviceId: string): void {
    const appAccountStore = useAppAccountStore()
    // 未登录时不允许连接
    if (!appAccountStore.isLogin) {
      console.warn('[DeviceWS] not logged in, skip connect')
      lastError.value = '未登录，无法建立 WebSocket 连接'
      return
    }
    if (ws.value || isConnecting.value) {
      return
    }

    isConnecting.value = true
    const url = getWsUrl()

    try {
      const socket = new WebSocket(url)
      ws.value = socket

      socket.onopen = () => {
        isConnected.value = true
        isConnecting.value = false
        reconnectAttempts = 0
        lastError.value = null

        // 发送队列中的消息
        while (pendingMessages.length > 0) {
          const msg = pendingMessages.shift()
          if (msg) {
            socket.send(JSON.stringify(msg))
          }
        }
      }

      socket.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as WsResponseMessage

          // 处理服务端下发的鉴权结果
          if (data.type === 'auth') {
            if (data.status !== 'ok') {
              console.warn('[DeviceWS] auth failed:', data.message)
              lastError.value = data.message || 'WebSocket 鉴权失败'
            }
            return
          }

          lastResponse.value = data
        }
        catch (e) {
          console.warn('[DeviceWS] parse error:', e)
        }
      }

      socket.onerror = (event: Event) => {
        console.error('[DeviceWS] error:', event)
        lastError.value = 'WebSocket 连接错误'
      }

      socket.onclose = (event: CloseEvent) => {
        isConnected.value = false
        isConnecting.value = false
        ws.value = null

        // 鉴权失败不重连
        if (WS_AUTH_ERROR_CODES.includes(event.code)) {
          console.warn('[DeviceWS] auth error, stop reconnect')
          lastError.value = event.reason || 'WebSocket 鉴权失败，请重新登录'
          pendingMessages.length = 0
          return
        }

        // 自动重连
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = reconnectBaseDelay * (2 ** reconnectAttempts)
          console.warn(`[DeviceWS] reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`)
          reconnectTimer = setTimeout(() => {
            reconnectAttempts++
            connect(deviceId)
          }, delay)
        }
        else {
          lastError.value = 'WebSocket 重连次数已耗尽'
        }
      }
    }
    catch (e) {
      console.error('[DeviceWS] connect failed:', e)
      isConnecting.value = false
      lastError.value = 'WebSocket 创建失败'
    }
  }

  function disconnect(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    reconnectAttempts = maxReconnectAttempts // 阻止重连
    if (ws.value) {
      ws.value.close(1000, 'user disconnect')
      ws.value = null
    }
    isConnected.value = false
    isConnecting.value = false
    pendingMessages.length = 0
  }

  function sendCommand(message: WsControlMessage): boolean {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(message))
      return true
    }

    // 离线时加入待发送队列
    pendingMessages.push(message)
    console.warn('[DeviceWS] not connected, queued message')
    return false
  }

  return {
    ws,
    isConnected,
    isConnecting,
    lastResponse,
    lastError,
    connect,
    disconnect,
    sendCommand,
  }
}
