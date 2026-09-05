/**
 * 同源出站代理客户端（懒猫微服部署形态专用）。
 *
 * 桌面端用 plugin-http 直连不受跨域限制；纯浏览器里，AI 供应商与榜单站点
 * 多数不下发 CORS 头，直连会被浏览器拦下。部署到懒猫微服时，随包的 Node
 * 服务在同源暴露 /api/health 与 /api/fetch：前端把目标请求装进"信封"发给
 * 同源代理，由服务端转发并原样回流响应（SSE 流式、二进制通吃）。
 *
 * - 启用条件：GET /api/health 返回 { proxy: true } 才启用；本地 dev（vite）
 *   或开源网页版没有该端点，探测失败自动回退浏览器直连，行为不变。
 * - 密钥仍在浏览器侧拼进请求头后整体装信封，代理只转发不落盘。
 * - User-Agent / Referer / Authorization 属浏览器受限头或跨域头，由服务端
 *   按信封代设（榜单抓取依赖 UA/Referer）。
 */

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

const PROBE_URL = '/api/health'
const PROXY_URL = '/api/fetch'
const RENDER_URL = '/api/render'

/** 信封请求体（含 JSON 文本）上限：榜单 HTML、字体文件、生图载荷都远够 */
const MAX_ENVELOPE_BYTES = 32 * 1024 * 1024

interface ProxyRequestEnvelope {
  url: string
  method: string
  headers: Record<string, string>
  /** 文本载荷原样传输 */
  body?: string
  /** 二进制载荷 base64 传输（字体下载等） */
  bodyBase64?: string
}

export interface WebProxyCapabilities {
  /** 同源代理转发可用 */
  proxy: boolean
  /** 服务端内置真实浏览器渲染抓取（起点反爬需要） */
  render: boolean
}

let capabilitiesPromise: Promise<WebProxyCapabilities | null> | null = null

const probeCapabilities = async (): Promise<WebProxyCapabilities | null> => {
  const response = await window.fetch(PROBE_URL, { method: 'GET' })
  if (!response.ok) return null
  const data = (await response.json().catch(() => null)) as
    | { proxy?: boolean; render?: boolean }
    | null
  if (!data?.proxy) return null
  return { proxy: true, render: Boolean(data.render) }
}

/**
 * 探测同源代理能力（结果按会话缓存）；无代理时返回 null（调用方回退浏览器直连，
 * 保持开源网页版原行为）。
 */
export const getWebProxyCapabilities = (): Promise<WebProxyCapabilities | null> => {
  if (!capabilitiesPromise) {
    capabilitiesPromise = probeCapabilities().catch(() => null)
  }
  return capabilitiesPromise
}

/** 取同源代理 fetch；代理不可用时返回 null（调用方回退直连） */
export const getWebProxyFetch = async (): Promise<FetchLike | null> => {
  const capabilities = await getWebProxyCapabilities()
  return capabilities?.proxy ? webProxyFetch : null
}

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  // 分段转换避免 String.fromCharCode 参数数量超限
  const chunkSize = 0x8000
  for (let start = 0; start < bytes.length; start += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize))
  }
  return btoa(binary)
}

/** 把 init.body 归一成信封字段；仅支持字符串与二进制（本应用全部出站形态） */
const encodeBody = (body: BodyInit | null | undefined): Pick<ProxyRequestEnvelope, 'body' | 'bodyBase64'> => {
  if (!body) return {}
  if (typeof body === 'string') return { body }
  if (body instanceof ArrayBuffer) {
    return { bodyBase64: bytesToBase64(new Uint8Array(body)) }
  }
  if (ArrayBuffer.isView(body)) {
    const view = body as Uint8Array
    return { bodyBase64: bytesToBase64(new Uint8Array(view.buffer, view.byteOffset, view.byteLength)) }
  }
  throw new Error('同源代理暂不支持该请求体类型（Blob/FormData 请改传字符串或二进制）')
}

/**
 * 信封转发：把目标请求装进 JSON 信封 POST 到同源 /api/fetch。
 * 响应体不做任何包装原样回流，因此 SSE 流式读取、JSON、二进制与直连同构；
 * 调用方传入的 signal 同时中止信封请求，服务端会级联中止对目标站的连接。
 */
export const webProxyFetch: FetchLike = async (input, init) => {
  const headers: Record<string, string> = {}
  new Headers(init?.headers).forEach((value, key) => {
    headers[key] = value
  })
  const envelope: ProxyRequestEnvelope = {
    url: String(input),
    method: String(init?.method || 'GET').toUpperCase(),
    headers,
    ...encodeBody(init?.body),
  }
  const payload = JSON.stringify(envelope)
  if (payload.length > MAX_ENVELOPE_BYTES) {
    throw new Error('代理请求数据超出上限（32MB）')
  }
  return window.fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: init?.signal,
    body: payload,
  })
}

export interface WebProxyRenderOptions {
  url: string
  /** 页面就绪的标志选择器（出现即认为内容已渲染） */
  waitSelector: string
  /** 懒加载滚动轮数；0 = 选择器出现即取 */
  scrollRounds?: number
  timeoutMs?: number
  signal?: AbortSignal
}

/**
 * 服务端真实浏览器渲染抓取：把目标页交给随包 worker 渲染后取回 HTML。
 * 起点全站 probe.js 反爬（纯 HTTP 只能拿到 202 探针页）走这条通道；
 * 仅当 /api/health 上报 render 能力时可用。
 */
export const webProxyRenderPage = async (options: WebProxyRenderOptions): Promise<string> => {
  const response = await window.fetch(RENDER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal,
    body: JSON.stringify({
      url: options.url,
      waitSelector: options.waitSelector,
      scrollRounds: options.scrollRounds || 0,
      timeoutMs: options.timeoutMs,
    }),
  })
  const body = (await response.json().catch(() => null)) as { html?: string; error?: string } | null
  if (!response.ok || !body?.html) {
    throw new Error(body?.error || `渲染抓取失败（HTTP ${response.status}）`)
  }
  return body.html
}
