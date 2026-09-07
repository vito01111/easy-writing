# 易创重提整改计划：榜单风向移除 + AGPL fork 合规

> 依据：2026-09-07 review 18401 拒审（"榜单风向功能仅供个人学习与创作参考，勿用于商业数据服务"）+ 当日 VIP 群与审核员对话确认的整改路径。
> 目标：满足审核员给出的两个条件——① AGPL 按上游要求开源分发自己的修改版；② 移除榜单风向（涉嫌商业数据）。

## 根因复盘（为什么会撞上这一枪）

- 上游 easy-writing 的榜单风向是**桌面版专属**（爬虫依赖 Tauri 系统能力，浏览器版官方不可用）；我们的移植做了**服务端真实浏览器渲染爬虫**让它网页端可用，并把"榜单抓取"当"懒猫版新增"卖点写进商店 description 和 changelog。
- 拒审话术几乎逐字是上游 README 免责声明的原文——**审核员真的点了 source 链接去读 README**；README 免责声明洗白不了功能本身。
- 教训：商店描述的功能列表就是审核依据；**抓取外部平台数据的功能无论怎么加免责声明都过不了**；把可疑功能当卖点写等于主动送审靶子。

## Phase 1 — 合规 fork（协议部分）

1. 建 fork 仓库 `github.com/vito01111/easy-writing`（真实 fork，提交历史可溯上游）。
2. LICENSE 保持 `AGPL-3.0-only` 原样不动，保留上游版权声明。
3. README 顶部加 fork 说明：基于 `yilujian/easy-writing`，列出修改点（移除榜单风向、懒猫网盘接入、服务端适配），附上游链接。
4. **推送完整移植源码**（网页端 + 服务端 + `lazycat/` 打包配置）——AGPL 网络服务条款要求对外提供服务的修改版开源；只留上游原始码或 fork 零提交悬空不算合规（minute 项目的前车之鉴）。
5. fork 打 tag 与送审版本一致（如 `v1.0.9-lzc`），保证审核员点开时 tag 可达、内容与送审包对应。
6. 字段改指：
   - `lazycat/package.yml`：`homepage` 改指 fork；`license` 不动。
   - `store-assets/store-submit.json`：`source` 改指 fork；`source_author` 保留 `yilujian`（上游署名，如实归属）。

## Phase 2 — 移除榜单风向（数据版权部分）

范围清单（实施时逐项核销，勿凭感觉删）：

**前端**
- `src/router/index.ts` 路由项与守卫；`Sidebar.vue` / `Header.vue` 菜单项
- `GlobalSearchPalette.vue` 榜单条目；榜单相关 view 组件整目录
- `src/stores/`：`local-rank-store` 删除、`app-config` 中榜单开关项
- `src/config/rank-sources.ts` 删除；`ai-prompts.ts` / `prompts/defaults-misc.ts` 中榜单 AI 解读 prompts
- i18n 词条、CSV 导出入口

**服务端**
- 服务端真实浏览器渲染爬虫整体移除；若无头浏览器依赖（puppeteer/playwright 等）仅为榜单引入，从镜像依赖一并移除（镜像瘦身）
- 代理出站规则中"榜单站点"域名段；`package.yml` 的 `net.internet` 权限注释同步去掉"榜单站点"字样

**桌面残留（fork 干净度）**
- `src-tauri/capabilities/rank-crawl.json` 及 tauri 侧榜单代码——一并删，防上游后续合并回灌

**边界（勿过度删除）**
- 码字统计的"趋势图/日历"是本地自有数据，**不在移除范围**
- 自查红线：移除后全仓 `grep -ri "榜单|风向|起点|番茄|七猫|rank"` 零残留（历史归档文档除外）
- 核对"图床"出站用途（package.yml 注释提及）：若是上传用户图片到公共图床，评估是否一并处理；确认无其他外部平台数据抓取功能残留

## Phase 3 — 商店资料整改

- `store-submit.json` description 删两处：原项目功能列表的"榜单风向内置番茄/起点/七猫适配器"、懒猫版新增的"榜单抓取经服务端真实浏览器渲染…"；changelog 同步改写。
- `store-assets/screenshots/` 榜单相关截图移除。
- 措辞检查：changelog 里"同源 AI 代理"的"代理"字样建议改为"服务端转发"（neko-master 因代理被拒的前车之鉴，避免关键词误伤；功能不变、描述如实）。
- 描述保留"开源 AGPL-3.0"与 fork 链接——把合规信号显式写在明面上。

## Phase 4 — 全量回归 + 重提（走重提前置门）

1. 版本 1.0.8 → 1.0.9（node 写入），重建镜像——确保爬虫在**二进制层面**移除，不是 UI 隐藏。
2. 全量回归（全部历史入口，不是只测本次改动）：
   - 导入/导出懒猫网盘拦截四段验收（入口/读取/写入/读回）
   - 免密登录、核心写作流（新建/编辑/自动保存/章节历史版本）
   - G1-G2 复跑，对照 `verify/1.0.8/audit/` 基线
3. G3-M preflight：source/license 字段、资料完整性。
4. `lazycat_store_submit.ps1 -Preflight` → 提审；提交说明注明"已按 9-7 反馈移除榜单风向，源码开源于 <fork 地址>"，给审核员明确信号。
5. 激励预期：审核员已明示 **AI 续写类无激励**——过审即达标，不期待红包。

## DoD 验收清单

- [ ] fork 仓库公开可达，含完整移植源码，LICENSE=AGPL-3.0-only，README 有 fork 说明，tag 与送审版本一致
- [ ] 全仓榜单代码/配置/文案/截图零残留（grep + 资料复查双重验证）
- [ ] 拦截四段 + 免密登录 + 核心写作流回归 PASS，证据归档 `verify/1.0.9/`
- [ ] `package.yml` / `store-submit.json` source 指向 fork
- [ ] preflight 全绿，提审完成，sweep 跟踪结果
