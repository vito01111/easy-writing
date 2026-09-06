# v1.0.8 部署评审报告（首次上架送审）

日期：2026-09-06 ｜ 实例：Status_Running @ https://easywriting.vito.heiyu.space ｜ LPK sha256 前 16：`3eacba0a2d7ad9e4`（store 瘦包，外置 runtime 镜像 `registry.lazycat.cloud/u87691755/ew394a48/easywriting-server:490d4bba6614b499`）

## 结论：核心链路全部通过（部署/功能/AI/榜单/文件拦截）

| 层 | 内容 | 结果 | 证据 |
|---|---|---|---|
| 部署 | v1.0.8 安装，app/server 双容器 healthy，公网入口 307 跳微服登录（鉴权层正常） | pass | lzc-cli project info；curl /api/health = `{ok:true,proxy:true,render:true,lazycatDrive:true}` |
| 全页面巡航 | 11 个路由（首页/作品/写作/工作流/统计/榜单/拆书/灵感/模型/提示词/反馈）逐页渲染 + console 错误门禁 | pass（0 error） | cat-browser console --fail-on error 逐页记录 |
| AI 端到端 | 模型拉取 431 个 → 连通测试 1043ms → 场景绑定 → 取名器真实生成 12 人名 → 妙笔对话流式回复 → 划词润色采纳替换正文 → 工作流灵感生成 → AI 调用账本 4 条全成功 | pass | IndexedDB ew-local-ai-records：name_generator/妙笔对话/划词工具/建书·灵感 各 1 条 status=1 |
| 榜单抓取 | 起点 100 条（5 页服务端渲染全过 probe.js 反爬，月票字体解码 0 乱码）、番茄 100 条、七猫 100 条 | pass | UI 抓取 toast + ew-local-rank |
| 编辑器链路 | 打字/边写边存（数据经宿主机重启后完好）/敏感词检测/手动保存/历史版本入口 | pass | IndexedDB chapter_contents + UI |
| 文件拦截 | intercept_check.py blocking=0：通道声明、运行态挂载、契约列表、用户隔离、穿越防护、写入→落盘→读回字节一致 | pass | verify/1.0.8/intercept-report.json |
| 导入导出闭环 | 导出《星际拾荒者》→ 保存到懒猫网盘（documents/vito/ 122 字节）→ 网盘对话框读回并导入成新书（识别 3 章 2 卷）→ 书架 1→2 本；测试数据已全部清理 | pass | 浏览器 QA 操作记录 |

## 覆盖映射（对照上架前检查清单）

- 真实入口 `/`：未登录 307 跳微服登录；登录后进入应用首页，无 404/空白/死路
- 多用户隔离：文件通道按 `X-HC-User-ID` 只进当前用户目录（L2.3 PASS，其他用户目录零泄露）
- 移动端三态：确认不支持 → `support.mobile=false`、`verified.mobile=false`、`screenshots.mobile=[]`，最终 LPK `package.yml.unsupported_platforms` 同时含 android/ios
- 许可证：最终 LPK `package.yml.license=AGPL-3.0-only` 与上游 LICENSE 一致
- 商店镜像硬门禁：瘦包顶层仅 `icon.png/manifest.yml/package.yml`，无 `images/`、`images.lock`、无 `embed:`，`image:` 为 `registry.lazycat.cloud/...`

## 人工签核项（不可自动化）

1. AI 流式生成的主观质量（已验证链路与落账，语义质量由 BYOK 用户自选模型决定）
2. 封面生图（需用户自配生图模型；请求管道与文本模型同路）
3. 起点隐藏窗口抓取（桌面版专属能力，网页端由服务端渲染替代并已实测）

## 复跑方式

```powershell
powershell -ExecutionPolicy Bypass -File scripts/lazycat-build-lpk.ps1            # dev 内嵌包
powershell -ExecutionPolicy Bypass -File scripts/lazycat-install-lpk.ps1          # 安装到默认 Box
powershell -ExecutionPolicy Bypass -File scripts/lazycat-postdeploy-verify.ps1    # 部署后验证
cd /d/7.code/lazycat-skills && CAT_BROWSER_CLI="node D:/7.code/cat-browser/dist/cli.js" python scripts/intercept_check.py --app-repo D:/7.code/easy-writing --domain https://easywriting.vito.heiyu.space
```

## 交付真实性审计与路由巡航（2026-09-07 补录，PASS）

按 `lazycat-deploy-verify/references/delivery-acceptance.md` 执行视角 A（交付真实性）验收：

- **交付审计**：`python <skills-repo>/scripts/lazycat_delivery_audit.py --app-repo . --fix-pattern "import fsSync"` → 32 项检查 blocking=0（V0 工件核账 / V1 瘦包 tar 独立复算 / V2 代码抽检 / V3 探活 / V4 门禁复核 / V5 远程对账（review 18401 本地-远程 SHA 逐字段一致）/ V6 视觉抽检）。报告见 `audit/audit-report.json`。
- **签核清单**：V2 四项（uid 隔离/防穿越/fsSync 修复/diff 范围）+ V6 七张截图，全部 PASS，记录见 `audit/signoffs.md`。
- **路由巡航**：`cruise.flow` 11 路由段式剧本（每段 tab new → wait → console --fail-on error → screenshot）经 cat-browser run 执行 59/59 步全绿，脱敏报告见 `audit/cruise-flow-report.json`，逐页截图 `screenshots/cruise-*.png`。
- **审计发现交付债已清偿**：删除 `store-assets/screenshots$NAME.png`（变量残留误提交）；`lazycat/lpk-store/` 入 .gitignore 并移出 git 跟踪（磁盘文件保留，SHA 不变）。遗留观察（changelogs 缺失、en 简介混语）见 `audit/signoffs.md`，随下版本资料更新处理。
