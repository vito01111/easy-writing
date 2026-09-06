# 交付审计 summary — cloud.lazycat.app.easywriting v1.0.8

**结论：WARN**（blocking=0 warning=4 ok=21 info=6 skip=1）

| 状态 | 检查 | 说明 |
|---|---|---|
| warning | v0.git-clean 工作区有 12 处未提交改动 | ?? verify/1.0.8/cruise.flow；?? verify/1.0.8/screenshots/cruise-01-home.png；?? verify/1.0.8/screenshots/cruise- |
| warning | v0.git-hygiene 跟踪文件名含 '$'（变量未展开残留） | store-assets/screenshots$NAME.png |
| warning | v0.git-hygiene-lpk LPK 二进制被提交进 git | lazycat/lpk-store/cloud.lazycat.app.easywriting-v1.0.8.lpk |
| warning | v5.quality-observations 送审质量观察项 | 远程 version.changelogs 缺失（人工审核常问更新内容）；本地 submit-result 为 VerifyOnly 演练——真实提交以远程 review 为准（本工具已按远程判定）；review_ite |
| ok | v0.lpk-dev dev LPK 在位 | cloud.lazycat.app.easywriting-v1.0.8.lpk，404870656 字节 |
| ok | v0.lpk-store store 瘦包在位 | cloud.lazycat.app.easywriting-v1.0.8.lpk，175616 字节，sha256 前 16 = 3eacba0a2d7ad9e4 |
| ok | v0.verify-evidence 验证证据包布局完整（报告 + 中文截图） |  |
| ok | v0.result-md result.md 含结论 PASS 行 |  |
| ok | v0.human-review-chain human-review 链产物齐全（4/4） |  |
| ok | v1.lpk-no-embedded-images 瘦包无内嵌镜像 | tar 成员：['icon.png', 'manifest.yml', 'package.yml'] |
| ok | v1.lpk-registry-ref 镜像引用走官方 registry | registry.lazycat.cloud/u87691755/ew394a48/easywriting-server:490d4bba6614b499 |
| ok | v1.lpk-no-embed-key manifest 无 embed: 段 |  |
| ok | v1.pkg-license package.yml 声明 license | AGPL-3.0-only |
| ok | v1.pkg-platforms unsupported_platforms 显式声明 | ['android', 'ios'] |
| ok | v1.pkg-permissions permissions.required 声明在位 | ['net.internet', 'document.private'] |
| ok | v1.manifest-env-placeholders manifest environment 无占位值 |  |
| ok | v3.entry-auth 入口 307 跳微服登录（鉴权层正常） |  |
| ok | v4.intercept-report intercept 报告结构自洽且 blocking=0 | warning 项：['L2.6'] |
| ok | v5.review-presence 远程 review 在位（id=18401） | 1 条记录，最新 updated 2026-09-06T00:44:51.589Z |
| ok | v5.field-reconcile 本地/远程版本与包哈希对账一致 | version=1.0.8 sha16=3eacba0a2d7ad9e4 |
| ok | v5.review-status 审核状态：待人工审核（status=0） |  |
| ok | v6.shot-dimensions 送审截图尺寸（4 张 PC） | pc-01-shelf.png=2566x1196；pc-02-writing.png=2566x1196；pc-03-rank.png=2566x1196；pc-04-models.png=2566x1196 |
| ok | v6.shot-duplicates 两两 PSNR 检测通过（4 张互不重复） |  |
| ok | v6.zh-evidence 中文界面证据（verify/screenshots/zh-*.png） | zh-01-shelf.png；zh-02-writing.png；zh-03-rank.png |
| ok | v0.cruise-flow 路由巡航剧本/报告在位 | cruise.flow；cruise-flow-report.json |
| info | v2.uid-isolation [签核] 用户隔离：uid 只取网关注入的 X-HC-User-ID | 3 处定位已记录 |
| info | v2.traversal-guard [签核] 防路径穿越：规范化 + 分段拒绝 + 前缀断言 | 11 处定位已记录 |
| info | v2.claimed-fix [签核] 声称修复核验：import fsSync | 1 处定位已记录 |
| info | v2.diff-scope 最近 lazycat/ 提交（未给 --base-ref，仅列出） | f26daf7 chore(store): v1.0.8 上架送审资料与 store lane 构建文件
40fae79 feat: 移植懒猫微服 Web 版：同源代理/服务端渲染抓取/懒猫网盘文件拦截 |
| info | v3.health /api/health 在鉴权后（307），属正常形态 |  |
| info | v6.content-signoff [签核] 截图内容人工签核：真实 UI / 语言正确 / 非空白 | 4 处定位已记录 |
| skip | v4.intercept-rerun 未指定 --rerun-intercept（默认只核报告不重跑） |  |

## 签核清单（人工/视觉模型逐项勾选）

### [V2] 用户隔离：uid 只取网关注入的 X-HC-User-ID
- 确认：uid 来自请求头而非用户可控参数；对 uid 做长度/斜杠/'..' 校验；所有路径拼接都以 <root>/<uid>/ 为前缀，不列出其他用户目录
  - lazycat\server.mjs:313：//     权限挂载的应用文稿）。uid 一律取网关注入的 X-HC-User-ID：
  - lazycat\server.mjs:322：const uid = String(req.headers['x-hc-user-id'] || '').trim()
  - src\utils\lazycat-drive.ts:11：* - 用户隔离在服务端按 X-HC-User-ID 完成，前端不传用户参数。

### [V2] 防路径穿越：规范化 + 分段拒绝 + 前缀断言
- 确认：用户可控路径经 normalize 后逐段拒绝空段/'.'/'..'；拼接结果做 startsWith(userRoot) 前缀断言；绝对路径被拒
  - lazycat\server.mjs:110：const relative = path.normalize(decoded).replace(/^([.][.][\\/])+/, '')
  - lazycat\server.mjs:113：if (!resolved.startsWith(STATIC_DIR + path.sep) && resolved !== STATIC_DIR) {
  - lazycat\server.mjs:117：const cacheImmutable = relative.startsWith(`assets${path.sep}`) || relative.startsWith('assets/')
  - lazycat\server.mjs:344：const rel = path.normalize(String(url.searchParams.get('path') || '')).replace(/^([\\/])+/, '')
  - lazycat\server.mjs:352：if (!target.startsWith(userRoot)) {
  - lazycat\server.mjs:479：if (url.pathname.startsWith('/api/lazycat/')) {
  - src\storage\local-ai-chat.ts:74：if (!text.startsWith('sessions:')) continue
  - src\storage\local-ai-chat.ts:136：if (!text.startsWith('messages:')) continue
  - src\storage\local-breakdown.ts:221：if (!text.startsWith('project:')) continue
  - src\storage\local-rank-store.ts:144：.filter(key => key.startsWith(prefix))
  - src\storage\local-workflow.ts:97：if (!text.startsWith('run:')) continue

### [V2] 声称修复核验：import fsSync
- 对照会话声称的修复（如 fsSync 导入），确认修复真实在码且无同类残留
  - lazycat\server.mjs:15：import fsSync from 'node:fs'

### [V6] 截图内容人工签核：真实 UI / 语言正确 / 非空白
- 逐张确认：是应用真实界面（非设计稿/拼图）；界面语言与商店宣称一致；无敏感信息（真实域名用户段/账号名）；无错误弹窗或加载态定格
  - store-assets\screenshots\pc-01-shelf.png:0：(2566, 1196)
  - store-assets\screenshots\pc-02-writing.png:0：(2566, 1196)
  - store-assets\screenshots\pc-03-rank.png:0：(2566, 1196)
  - store-assets\screenshots\pc-04-models.png:0：(2566, 1196)


生成：2026-09-06T09:24:29+08:00｜工具：lazycat_delivery_audit.py（只读审计）
