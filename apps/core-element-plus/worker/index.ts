/**
 * Cloudflare Worker — IoT Platform 数据查询缓存
 *
 * 仅 /api/data/* 路径走代理缓存，其余请求回退到 SPA 静态资源。
 *
 * 请求流向：
 *   /api/data/*    → Worker 代理 → 后端 API → Cache API 缓存
 *   /api/__health  → Worker 健康检查（带缓存验证）
 *   其他所有路径    → env.ASSETS（SPA 静态文件）
 */

interface Env {
  /** 后端 API 地址 */
  API_BASE_URL: string
  /** Hyperdrive 绑定 — PostgreSQL 连接池 */
  HYPERDRIVE: Hyperdrive
  /** Static Assets（wrangler 自动注入） */
  ASSETS: { fetch: (req: Request) => Promise<Response> }
}

// ─── 缓存配置 ───────────────────────────────────────────────

const CACHE_TTL = {
  data: 5, // 遥测数据 5 秒
  health: 30, // 健康检查 30 秒
}

// ─── 工具函数 ───────────────────────────────────────────────

function buildCacheKey(request: Request): Request {
  const url = new URL(request.url)
  const auth = request.headers.get('Authorization')
  if (auth) {
    const suffix = auth.replace(/[^a-z0-9]/gi, '').slice(-8) || 'anon'
    const segments = url.pathname.split('/')
    segments.splice(1, 0, `_u:${suffix}`)
    url.pathname = segments.join('/')
  }
  return new Request(url.toString(), request)
}

// ─── 数据 API 代理 + 缓存 ──────────────────────────────────

async function proxyWithCache(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url)
  const apiPath = url.pathname.replace(/^\/api/, '')
  const backendUrl = `${env.API_BASE_URL}${apiPath}${url.search}`

  const cache = caches.default

  // GET 请求查缓存
  if (request.method === 'GET') {
    const cacheKey = buildCacheKey(request)
    const cached = await cache.match(cacheKey)
    if (cached) {
      const res = new Response(cached.body, cached)
      res.headers.set('X-Cache', 'HIT')
      res.headers.set('X-Worker', 'iotplatform-web')
      return res
    }
  }

  // 转发到后端
  const backendHeaders = new Headers(request.headers)
  backendHeaders.set('Host', new URL(env.API_BASE_URL).host)

  const backendResponse = await fetch(backendUrl, {
    method: request.method,
    headers: backendHeaders,
    body: request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.arrayBuffer()
      : undefined,
    redirect: 'manual',
  })

  const response = new Response(backendResponse.body, backendResponse)
  response.headers.set('X-Cache', 'MISS')
  response.headers.set('X-Worker', 'iotplatform-web')

  // 成功 GET 响应写入缓存
  if (request.method === 'GET' && backendResponse.status === 200) {
    const cacheKey = buildCacheKey(request)
    const ttl = CACHE_TTL.data
    const cachedResponse = new Response(response.body, response)
    cachedResponse.headers.set('Cache-Control', `public, max-age=${ttl}`)
    ctx.waitUntil(cache.put(cacheKey, cachedResponse))
  }

  return response
}

// ─── 健康检查 ───────────────────────────────────────────────

async function healthCheck(
  request: Request,
  ctx: ExecutionContext,
): Promise<Response> {
  const cache = caches.default
  const cacheKey = buildCacheKey(request)
  const cached = await cache.match(cacheKey)
  if (cached) {
    const res = new Response(cached.body, cached)
    res.headers.set('X-Cache', 'HIT')
    res.headers.set('X-Worker', 'iotplatform-web')
    return res
  }

  const body = JSON.stringify({ ok: true, ts: Date.now() })
  const res = new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
  })
  res.headers.set('X-Cache', 'MISS')
  res.headers.set('X-Worker', 'iotplatform-web')
  ctx.waitUntil(cache.put(cacheKey, res.clone()))
  return res
}

// ─── 主入口 ──────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url)

      // 健康检查
      if (url.pathname === '/api/__health') {
        return healthCheck(request, ctx)
      }

      // 仅数据查询走代理缓存
      if (url.pathname.startsWith('/api/data/')) {
        return proxyWithCache(request, env, ctx)
      }

      // 其他 /api/* 路径不处理（前端应直连 api.meatsuger.top）
      if (url.pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({
          error: 'Not Found via Worker',
          message: '此 API 路径不走 Worker 代理，请直接访问 api.meatsuger.top',
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // 其他所有请求回退到 SPA 静态资源
      return env.ASSETS.fetch(request)
    }
    catch (err: any) {
      // 未处理异常兜底，避免 1101 错误
      return new Response(JSON.stringify({
        error: 'Internal Worker Error',
        message: err?.message || String(err),
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  },
}
