// 易创 · 懒猫微服随包服务：静态站点 + 同源出站转发代理（零 npm 依赖）。
//
// 职责只有两件事：
// 1. 托管前端构建产物（SPA history 路由回退 index.html）；
// 2. /api/fetch 信封转发：网页端直连 AI 供应商/榜单站/图床会被浏览器 CORS
//    拦下，由本服务在服务端转发并原样回流响应（SSE 流式、二进制通吃）。
//    请求体是前端 web-proxy-fetch.ts 装的信封 JSON：
//      { url, method, headers, body?, bodyBase64? }
//    UA/Referer/Authorization 等受限头由这里代设；密钥只在信封里过境，不落盘。
//
// 安全边界：应用全部路由都在懒猫微服登录态之后（未配 public_path），
// 代理仅对登录到微服的家庭成员可用；目标只放行 http/https。
import http from 'node:http'
import { spawn } from 'node:child_process'
import fsSync from 'node:fs'
import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT || 3000)
// path.resolve 归一化分隔符：env 传入的正斜杠路径要与 path.join 产物做前缀比对
const STATIC_DIR = path.resolve(process.env.STATIC_DIR
  || path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist'))
// 渲染抓取 worker（起点反爬需要真实浏览器渲染）；未配置时 /api/render 不可用
const RENDER_WORKER = process.env.RENDER_WORKER
  ? path.resolve(process.env.RENDER_WORKER)
  : path.join(path.dirname(fileURLToPath(import.meta.url)), 'render_worker.py')
const RENDER_PYTHON = process.env.RENDER_PYTHON || 'python3'
const MAX_BODY_BYTES = 32 * 1024 * 1024
const MAX_RENDER_HTML_BYTES = 24 * 1024 * 1024
const RENDER_HARD_TIMEOUT_MS = 120_000
// 渲染进程吃内存（Chromium ~300MB），串行跑保护家庭 Box；并发请求直接 503
// 懒猫文件通道挂载根（读=网盘 RemoteFS，写=应用文稿 documents）
const REMOTE_FS_ROOT = process.env.REMOTE_FS_ROOT || '/lzcapp/media/RemoteFS'
const DOCUMENTS_ROOT = process.env.DOCUMENTS_ROOT || '/lzcapp/documents'
const MAX_LAZYCAT_FILE_BYTES = 200 * 1024 * 1024
const CONNECT_TIMEOUT_MS = 20_000
const SOCKET_IDLE_TIMEOUT_MS = 300_000

let renderBusy = false

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
}

// 转发给目标站时要剥掉的信封头：由 Node 按目标 URL 重算或属于逐跳头
const STRIPPED_REQUEST_HEADERS = new Set([
  'host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade',
  'content-length', 'accept-encoding', 'origin', 'referer', 'cookie',
])
// 回给浏览器时只透传这些响应头（set-cookie 等一概不外带）
const PASSTHROUGH_RESPONSE_HEADERS = [
  'content-type', 'content-disposition', 'cache-control',
  'etag', 'last-modified', 'accept-ranges', 'content-length',
]

const sendJson = (res, status, payload) => {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

// ---------------------------------------------------------------------------
// 静态站点（SPA history 路由：找不到的路径回退 index.html）
// ---------------------------------------------------------------------------

const readSendFile = async (res, filePath, cacheControl) => {
  const ext = path.extname(filePath).toLowerCase()
  const body = await fs.readFile(filePath)
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': cacheControl,
    'Content-Length': body.length,
  })
  res.end(body)
}

const serveStatic = async (req, res, pathname) => {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return sendJson(res, 400, { error: 'bad path' })
  }
  const relative = path.normalize(decoded).replace(/^([.][.][\\/])+/, '')
  const resolved = path.join(STATIC_DIR, relative)
  // 归一化后必须仍落在静态目录内，防路径穿越
  if (!resolved.startsWith(STATIC_DIR + path.sep) && resolved !== STATIC_DIR) {
    return sendJson(res, 403, { error: 'forbidden' })
  }

  const cacheImmutable = relative.startsWith(`assets${path.sep}`) || relative.startsWith('assets/')
  let filePath = resolved
  try {
    const stat = await fs.stat(filePath)
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html')
  } catch {
    // 不存在的路径：带扩展名当静态资源 404；否则视为前端路由，回退 index.html
    if (path.extname(relative)) return sendJson(res, 404, { error: 'not found' })
    filePath = path.join(STATIC_DIR, 'index.html')
  }
  try {
    await readSendFile(res, filePath, cacheImmutable ? 'public, max-age=31536000, immutable' : 'no-cache')
  } catch {
    sendJson(res, 404, { error: 'not found' })
  }
}

// ---------------------------------------------------------------------------
// /api/fetch 信封转发
// ---------------------------------------------------------------------------

const readBody = req => new Promise((resolve, reject) => {
  const chunks = []
  let size = 0
  req.on('data', chunk => {
    size += chunk.length
    if (size > MAX_BODY_BYTES) {
      reject(new Error('body too large'))
      req.destroy()
      return
    }
    chunks.push(chunk)
  })
  req.on('end', () => resolve(Buffer.concat(chunks)))
  req.on('error', reject)
})

const handleProxy = async (req, res) => {
  let envelope
  try {
    envelope = JSON.parse((await readBody(req)).toString('utf8'))
  } catch {
    return sendJson(res, 400, { error: 'invalid envelope' })
  }

  let target
  try {
    target = new URL(String(envelope.url || ''))
  } catch {
    return sendJson(res, 400, { error: 'invalid url' })
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return sendJson(res, 400, { error: 'only http/https targets are allowed' })
  }

  const method = String(envelope.method || 'GET').toUpperCase()
  const headers = {}
  for (const [key, value] of Object.entries(envelope.headers || {})) {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers[key] = String(value)
  }
  // 显式要 identity：转发是原字节管道，不参与内容编码协商
  headers['accept-encoding'] = 'identity'

  let body
  if (envelope.bodyBase64) body = Buffer.from(String(envelope.bodyBase64), 'base64')
  else if (typeof envelope.body === 'string') body = Buffer.from(envelope.body, 'utf8')
  if (body && method !== 'GET' && method !== 'HEAD') headers['content-length'] = body.length

  const controller = new AbortController()
  // 客户端断开（取消生成/翻页离开）级联中止对目标站的连接
  res.on('close', () => {
    if (!res.writableEnded) controller.abort()
  })

  let upstream
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: body && method !== 'GET' && method !== 'HEAD' ? body : undefined,
      signal: controller.signal,
      redirect: 'follow',
    })
  } catch (error) {
    if (controller.signal.aborted) return
    const reason = error?.cause?.code || error?.message || 'upstream unreachable'
    return sendJson(res, 502, { error: `upstream request failed: ${reason}` })
  }

  const responseHeaders = {}
  for (const key of PASSTHROUGH_RESPONSE_HEADERS) {
    const value = upstream.headers.get(key)
    if (value) responseHeaders[key] = value
  }
  res.writeHead(upstream.status, responseHeaders)
  if (!upstream.body) return res.end()

  try {
    const reader = upstream.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!res.write(value)) {
        await new Promise(resolve => res.once('drain', resolve))
      }
    }
    res.end()
  } catch {
    if (!res.writableEnded) res.end()
  }
}

// ---------------------------------------------------------------------------
// /api/render：真实浏览器渲染抓取（起点 probe.js 反爬必须执行 JS 才能过）
// ---------------------------------------------------------------------------

const runRenderWorker = req => new Promise((resolve, reject) => {
  const child = spawn(RENDER_PYTHON, [RENDER_WORKER], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  })
  let stdout = ''
  let stderr = ''
  const timer = setTimeout(() => {
    child.kill('SIGKILL')
    reject(new Error('render timeout'))
  }, RENDER_HARD_TIMEOUT_MS)
  child.stdout.on('data', chunk => {
    stdout += chunk
    if (stdout.length > MAX_RENDER_HTML_BYTES) child.kill('SIGKILL')
  })
  child.stderr.on('data', chunk => { stderr += chunk })
  child.on('error', error => {
    clearTimeout(timer)
    reject(error)
  })
  child.on('close', code => {
    clearTimeout(timer)
    if (code === 0) {
      try {
        resolve(JSON.parse(stdout))
      } catch {
        reject(new Error('worker returned invalid json'))
      }
    } else {
      let message = 'render worker failed'
      try { message = JSON.parse(stderr).error || message } catch { /* keep default */ }
      reject(new Error(message))
    }
  })
  child.stdin.end(JSON.stringify(req))
})

const handleRender = async (req, res) => {
  if (!existsSync(RENDER_WORKER)) {
    return sendJson(res, 501, { error: 'render worker not configured' })
  }
  if (renderBusy) {
    return sendJson(res, 503, { error: '渲染抓取进行中，请稍后再试' })
  }
  let envelope
  try {
    envelope = JSON.parse((await readBody(req)).toString('utf8'))
  } catch {
    return sendJson(res, 400, { error: 'invalid request' })
  }
  const target = String(envelope.url || '')
  if (!/^https?:\/\//.test(target)) {
    return sendJson(res, 400, { error: 'only http/https targets are allowed' })
  }
  const waitSelector = String(envelope.waitSelector || '')
  if (!waitSelector || waitSelector.length > 200) {
    return sendJson(res, 400, { error: 'waitSelector required' })
  }

  renderBusy = true
  try {
    const result = await runRenderWorker({
      url: target,
      waitSelector,
      scrollRounds: Number(envelope.scrollRounds) || 0,
      timeoutMs: Number(envelope.timeoutMs) || undefined,
    })
    return sendJson(res, 200, result)
  } catch (error) {
    return sendJson(res, 502, { error: error?.message || 'render failed' })
  } finally {
    renderBusy = false
  }
}

// ---------------------------------------------------------------------------
// 懒猫文件通道（应用侧显式通道，K7 审核认可形态）
//
// 读：/lzcapp/media/RemoteFS/<uid>（ext_config.enable_media_access 挂载的网盘，
//     含百度/夸克等远程挂载）；写：/lzcapp/documents/<uid>（document.private
//     权限挂载的应用文稿）。uid 一律取网关注入的 X-HC-User-ID：
// - 只进当前用户目录，绝不列出其他用户目录（审核雷区 1）；
// - 路径拼接一律规范化并拒绝 .. 与绝对路径（防穿越）；
// - 目录逐项容错：远程挂载未就绪标 reachable:false，不炸整个列表（审核雷区 2）。
// ---------------------------------------------------------------------------

const LAZYCAT_READY = existsSync(REMOTE_FS_ROOT) || existsSync(DOCUMENTS_ROOT)

const currentUid = req => {
  const uid = String(req.headers['x-hc-user-id'] || '').trim()
  if (!uid || uid.length > 64 || /[\\/]/.test(uid) || uid.includes('..')) return null
  return uid
}

const LAZYCAT_ROOTS = {
  netdisk: REMOTE_FS_ROOT,
  documents: DOCUMENTS_ROOT,
}

const resolveLazycatPath = (req, res, url) => {
  const root = url.searchParams.get('root') || 'netdisk'
  const base = LAZYCAT_ROOTS[root]
  if (!base) {
    sendJson(res, 400, { ok: false, error: 'invalid root' })
    return null
  }
  const uid = currentUid(req)
  if (!uid) {
    sendJson(res, 401, { ok: false, error: 'unauthorized' })
    return null
  }
  const rel = path.normalize(String(url.searchParams.get('path') || '')).replace(/^([\\/])+/, '')
  const segs = rel && rel !== '.' ? rel.split(/[\\/]/) : []
  if (segs.some(seg => !seg || seg === '.' || seg === '..')) {
    sendJson(res, 400, { ok: false, error: 'invalid path' })
    return null
  }
  const userRoot = path.join(base, uid)
  const target = segs.length ? path.join(userRoot, ...segs) : userRoot
  if (!target.startsWith(userRoot)) {
    sendJson(res, 400, { ok: false, error: 'invalid path' })
    return null
  }
  return { root, uid, userRoot, target: segs.length ? target : null, dir: target }
}

const listDirSafe = dir => {
  try {
    return fsSync.readdirSync(dir, { withFileTypes: true })
  } catch {
    return null
  }
}

const handleLazycatList = (req, res, url) => {
  if (!LAZYCAT_READY) return sendJson(res, 501, { ok: false, error: 'lazycat-unavailable' })
  const ctx = resolveLazycatPath(req, res, url)
  if (!ctx) return
  // netdisk：用户目录必须存在才列（不猜、不回退到 RemoteFS 根——审核雷区 1）
  if (ctx.root === 'netdisk' && !existsSync(ctx.userRoot)) {
    return sendJson(res, 200, { ok: false, error: 'user-dir-not-found' })
  }
  // documents：目录未创建前视为空列表（首次导出前没有任何文件）
  if (!existsSync(ctx.dir)) {
    if (ctx.root === 'documents') return sendJson(res, 200, { ok: true, items: [] })
    return sendJson(res, 200, { ok: false, error: 'dir-not-found' })
  }
  const dirents = listDirSafe(ctx.dir)
  if (!dirents) return sendJson(res, 200, { ok: false, error: 'unreachable', items: [] })
  const items = []
  for (const entry of dirents) {
    const item = { name: entry.name, dir: entry.isDirectory() }
    try {
      if (item.dir) {
        try {
          fsSync.readdirSync(path.join(ctx.dir, entry.name))
          item.reachable = true
        } catch {
          item.reachable = false // 远程挂载未就绪/无权限：标灰展示
        }
      } else {
        item.size = fsSync.statSync(path.join(ctx.dir, entry.name)).size
      }
    } catch {
      if (item.dir) item.reachable = false
      else item.size = null
    }
    items.push(item)
  }
  items.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name, 'zh') : a.dir ? -1 : 1))
  sendJson(res, 200, { ok: true, items })
}

const handleLazycatFile = (req, res, url) => {
  if (!LAZYCAT_READY) return sendJson(res, 501, { ok: false, error: 'lazycat-unavailable' })
  const ctx = resolveLazycatPath(req, res, url)
  if (!ctx) return
  if (!ctx.target) return sendJson(res, 400, { ok: false, error: 'file path required' })
  let stat
  try {
    stat = fsSync.statSync(ctx.target)
  } catch {
    return sendJson(res, 404, { ok: false, error: 'file-not-found' })
  }
  if (!stat.isFile()) return sendJson(res, 400, { ok: false, error: 'not a file' })
  if (stat.size > MAX_LAZYCAT_FILE_BYTES) return sendJson(res, 413, { ok: false, error: 'file too large' })
  try {
    const body = fsSync.readFileSync(ctx.target)
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
    })
    res.end(body)
  } catch {
    sendJson(res, 502, { ok: false, error: 'read failed (mount may be offline)' })
  }
}

const handleLazycatSave = async (req, res) => {
  if (!LAZYCAT_READY) return sendJson(res, 501, { ok: false, error: 'lazycat-unavailable' })
  let body
  try {
    body = JSON.parse((await readBody(req)).toString('utf8'))
  } catch {
    return sendJson(res, 400, { ok: false, error: 'invalid request' })
  }
  const fakeUrl = new URL(`http://127.0.0.1/root?root=${encodeURIComponent(body.root || 'documents')}&path=${encodeURIComponent(String(body.path || ''))}`)
  const ctx = resolveLazycatPath(req, res, fakeUrl)
  if (!ctx) return
  if (ctx.root !== 'documents') return sendJson(res, 400, { ok: false, error: 'save only allowed to documents' })
  const filename = path.basename(String(body.filename || ''))
  if (!filename || filename === '.' || filename === '..' || /[\\/]/.test(filename)) {
    return sendJson(res, 400, { ok: false, error: 'invalid filename' })
  }
  const content = typeof body.content === 'string'
    ? Buffer.from(body.content, 'utf8')
    : typeof body.contentBase64 === 'string'
      ? Buffer.from(body.contentBase64, 'base64')
      : null
  if (!content) return sendJson(res, 400, { ok: false, error: 'content required' })
  if (content.length > MAX_BODY_BYTES) return sendJson(res, 413, { ok: false, error: 'content too large' })
  try {
    fsSync.mkdirSync(ctx.dir, { recursive: true })
    const target = path.join(ctx.dir, filename)
    fsSync.writeFileSync(target, content)
    const rel = path.relative(DOCUMENTS_ROOT, target).split(path.sep).join('/')
    sendJson(res, 200, { ok: true, path: rel })
  } catch {
    sendJson(res, 502, { ok: false, error: 'write failed' })
  }
}

// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)
  if (url.pathname === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      proxy: true,
      render: existsSync(RENDER_WORKER),
      lazycatDrive: LAZYCAT_READY,
      app: 'easywriting',
    })
  }
  if (url.pathname.startsWith('/api/lazycat/')) {
    if (url.pathname === '/api/lazycat/list') {
      return void Promise.resolve(handleLazycatList(req, res, url)).catch(error => {
        console.error('lazycat list error', error)
        if (!res.writableEnded) sendJson(res, 500, { ok: false, error: 'internal error' })
      })
    }
    if (url.pathname === '/api/lazycat/file') {
      return void Promise.resolve(handleLazycatFile(req, res, url)).catch(error => {
        console.error('lazycat file error', error)
        if (!res.writableEnded) sendJson(res, 500, { ok: false, error: 'internal error' })
      })
    }
    if (url.pathname === '/api/lazycat/save') {
      if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method not allowed' })
      return void handleLazycatSave(req, res).catch(error => {
        console.error('lazycat save error', error)
        if (!res.writableEnded) sendJson(res, 500, { ok: false, error: 'internal error' })
      })
    }
    return sendJson(res, 404, { ok: false, error: 'not found' })
  }
  if (url.pathname === '/api/fetch') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' })
    return void handleProxy(req, res).catch(error => {
      console.error('proxy handler error', error)
      if (!res.writableEnded) sendJson(res, 500, { error: 'internal error' })
    })
  }
  if (url.pathname === '/api/render') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' })
    return void handleRender(req, res).catch(error => {
      console.error('render handler error', error)
      if (!res.writableEnded) sendJson(res, 500, { error: 'internal error' })
    })
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: 'method not allowed' })
  }
  serveStatic(req, res, url.pathname).catch(error => {
    console.error('static handler error', error)
    if (!res.writableEnded) sendJson(res, 500, { error: 'internal error' })
  })
})

// 长流式补全（实测可超 10 分钟）：不设请求头超时上限；socket 空闲 5 分钟
// 无任何数据才掐断（供应商流挂死护栏），正常生成期间持续有数据不会触发
server.requestTimeout = 0
server.headersTimeout = 60_000
server.timeout = SOCKET_IDLE_TIMEOUT_MS

server.listen(PORT, () => {
  console.log(`easy-writing server listening on :${PORT}, static dir: ${STATIC_DIR}`)
})
