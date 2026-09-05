# 懒猫微服移植说明（lazycat/）

易创（easy-writing）的 LazyCat Box LPK 移植层。上游是 Tauri 桌面应用，本移植
走 **Web lane**：应用本身自带完整的网页端形态（IndexedDB 存储、浏览器回退），
改造后以「静态前端 + 零依赖 Node 同源代理」的 LPK V2 结构部署。

## 架构

```
浏览器（懒猫 SSO 之后）
  └─ https://easywriting.<box>.heiyu.space/
       ├─ /            → services/server: 静态站点（SPA history 路由回退）
       ├─ /api/health  → 探活 { ok, proxy, render, lazycatDrive }
       ├─ /api/fetch   → 信封出站转发（AI 供应商 / 榜单站 / 图床，SSE 流式通吃）
       ├─ /api/render  → 服务端真实浏览器渲染抓取（DrissionPage + Chromium，
       │                 起点全站 probe.js 反爬必须执行 JS 才能过；抓完即退，
       │                 串行互斥，不常驻内存）
       └─ /api/lazycat/* → 懒猫文件通道契约接口（list / file / save）
```

- **数据存哪**：沿用应用网页端设计——全部用户数据（书、章节、版本、提示词、
  AI 记录）存浏览器 IndexedDB，每个家庭成员天然隔离，契合上游"纯本地"理念。
  AI 密钥（BYOK）只存在浏览器 localStorage，代理仅转发不落盘。
- **为什么要代理**：上游桌面端用 plugin-http 直连不受 CORS 限制；纯浏览器里
  多数 AI 供应商与番茄/七猫榜单不下发 CORS 头。随包 Node 服务在同源暴露
  `/api/fetch`，前端把请求装信封（URL/方法/头/体）发给代理，服务端转发并
  原样回流响应；UA/Referer/Authorization 由服务端代设。
- **为什么要渲染抓取**：起点榜单页对纯 HTTP 请求返回 202 + 209 字节的
  probe.js 探针拦截页（实测复现），必须真实浏览器执行 JS 过探针。桌面版用
  隐藏 Tauri 窗口；本移植在容器内内置 Chromium（Debian apt 包）+ DrissionPage
  worker（`render_worker.py`），`/api/render` 按需拉起单次渲染进程（选型调研
  结论：DrissionPage 国内站点实战案例最多；nodriver/Camoufox 隐身上限更高但
  对"真实浏览器即可过"的 probe.js 属火力过剩）。月票反爬字体经代理下载后由
  前端解码，实测无 PUA 乱码残留。
- **懒猫文件通道（文件拦截，K7 审核认可形态）**：
  - 读通道：`ext_config.enable_media_access` → 容器内 `/lzcapp/media/RemoteFS`，
    导入时浏览/读取用户网盘（含夸克/百度等远程挂载）；
  - 写通道：`document.private` 权限 → `/lzcapp/documents/<uid>`，导出/保存
    落应用文稿（文件管理可见、卸载不清理）；
  - 契约接口：`GET /api/lazycat/list?root=netdisk|documents`、
    `GET /api/lazycat/file`、`POST /api/lazycat/save`（intercept_check.py
    自动验收依据）；用户隔离按网关注入的 `X-HC-User-ID`，只进当前用户目录；
    目录逐项容错（远程挂载未就绪标 reachable:false）；
  - 前端入口（标准文案）：导入弹窗「从懒猫网盘打开」（书架导入/章节导入/
    拆书导入三处）、导出时「保存到懒猫网盘 / 保存到本机」二选一
    （saveBlobFile 单一出口，书架导出/榜单 CSV/拆书报告/封面图片全量覆盖）；
    非懒猫环境（桌面版/开源网页版）探测不到通道时入口自动隐藏，行为不变。
- **前端改造面**（已并入 src/，桌面版行为不变）：
  - `src/utils/web-proxy-fetch.ts` 新增：信封代理客户端 + 能力探测（proxy/
    render），探测失败自动回退浏览器直连（开源网页版行为不变，本地 dev 同样
    不受影响）
  - `src/utils/local-ai-client.ts`：网页分支优先走代理
  - `src/utils/local-rank-crawler.ts`：番茄/七猫榜单在代理下网页端可用
  - `src/utils/local-rank-window.ts`：渲染型榜单（起点）网页端走 /api/render
  - `src/utils/local-rank-qidian.ts`：反爬字体下载去掉桌面版门槛
  - `src/utils/image-proxy.ts`：远程图片直连被 CORS 拦下时回退代理
- **服务端**：`server.mjs` 零 npm 依赖（node:http + 全局 fetch + child_process），
  静态目录防穿越、代理目标仅放行 http/https、socket 空闲 5 分钟掐断挂死流、
  客户端取消级联中止出站连接。
- **桌面版专属功能在网页端的形态**：标题栏/应用内更新/目录自动备份不可用
  （应用自身按 `isTauriRuntime()` 优雅降级）；更新由懒猫商店接管。

## 构建 / 安装 / 验证

```powershell
# 构建（build.mjs 会先 pnpm build 预构建前端，再组装 Box 侧镜像上下文）
powershell -ExecutionPolicy Bypass -File scripts/lazycat-build-lpk.ps1

# 安装到默认 Box（需先打开懒猫微服桌面客户端，否则 *.heiyu.space 解析不到）
powershell -ExecutionPolicy Bypass -File scripts/lazycat-install-lpk.ps1

# 部署后验证（实例状态 / 容器日志 / 公网入口 smoke）
powershell -ExecutionPolicy Bypass -File scripts/lazycat-postdeploy-verify.ps1
```

只改了前端想快速重打镜像时：`$env:EW_SKIP_FRONTEND_BUILD="1"` 再跑 build
（build.mjs 跳过 pnpm build，直接复用现有 dist/）。

## 包内容

| 文件 | 作用 |
|---|---|
| `package.yml` | LPK V2 元数据与权限（net.internet + document.private 必须 / net.lan 可选） |
| `lzc-manifest.yml` | 运行结构：单服务 `server`，根路由全量接管 |
| `lzc-build.yml` | 构建配置：buildscript + images（embed:server） |
| `build.mjs` | 构建编排：前端预构建 + dist/server 打 tar 进镜像上下文 |
| `Dockerfile` | node:22-bookworm-slim + python3 + chromium（apt/pip 全走国内源） |
| `server.mjs` | 静态站点 + /api/fetch 信封代理 + /api/render 渲染端点（零依赖） |
| `render_worker.py` | DrissionPage 渲染抓取 worker（单次生命周期，stdin/stdout 协议） |
| `icon.png` | 上游 public/logo.png 压平转 512×512（<200KiB） |

## 已知边界（dev lane）

- 商店送审另需：外置镜像瘦包（当前内嵌镜像 ~386MB，含 Chromium）、
  `lazycat_store_submit.ps1 -Preflight`、文件能力三入口验收（导出/导入接入
  懒猫网盘的 auto-intercept 注入）。
- 目录自动备份（桌面版写本地文件夹）网页端无对应能力；导出走浏览器下载。
- healthcheck 用 node 内置 fetch 自检——bookworm-slim 无 wget/curl，别改回
  wget 方案（v1.0.7 实测踩过：容器被判 unhealthy 起不来）。
