# v1.0.9 部署评审报告（review 18401 整改重提）

日期：2026-09-07 ｜ 实例：Status_Running @ https://easywriting.vito.heiyu.space ｜ LPK sha256 前 16：见 `store-assets/store-submit-report.json`（store 瘦包，外置 runtime 镜像 `registry.lazycat.cloud/u87691755/ew394a48/easywriting-server:48dc280ce1922908`）
整改依据：`docs/plan-board-removal-and-license.md`（2026-09-07 review 18401 拒审：榜单风向 + AGPL fork 合规）

## 结论：整改项全部落地，全量回归通过

| 层 | 内容 | 结果 | 证据 |
|---|---|---|---|
| Phase 1 合规 fork | fork `github.com/vito01111/easy-writing`（含上游完整历史），完整移植源码已推送 main，README 顶部 fork 说明，package.yml homepage / store source 改指 fork | pass | git push --force 输出（1569afd main）；GitHub 仓库公开可达 |
| Phase 2 榜单移除 | 前端：路由/侧栏/标题映射/全局搜索/视图目录/存储层/类型/prompts 全删；服务端：/api/render 端点 + render_worker 删除；桌面：tauri rank_crawl 命令 + capabilities 删除；镜像：chromium/python3 依赖整体移除（Dockerfile 改回 node:22-alpine，镜像 1.07GB → 201MB） | pass | 全仓红线 grep：代码零残留（例外清单见下） |
| Phase 3 商店资料 | description 删两处榜单表述；changelog 注明"按审核反馈移除榜单风向 + 源码开源"；截图移除榜单页；"代理"字样改"服务端转发" | pass | store-submit.json 复查 |
| 部署回归 | v1.0.9 安装成功，双容器 healthy，health `{ok,proxy,lazycatDrive}`，首页 200 | pass | curl 记录 |
| 全页面巡航 | 8 个路由渲染正常，无榜单 UI 残留，console 零 error | pass | cat-browser 逐页记录 |
| 文件拦截四段 | 导出 → 保存到懒猫网盘 → documents/vito/星际拾荒者-20260907.txt（593 字节）→ API 读回可见 | pass | API list 输出 |
| 工作流交互 | 创作方向：选平台/读者/类型链路正常（分类下拉简化为纯题材后无回归） | pass | 浏览器交互记录 |
| /api/render 移除核验 | POST /api/render → 405（静态分支拒绝，端点已不存在）；容器内 `render_worker.py`、`chromium`、`python3` 均不存在 | pass | lzc-docker run ls 检查 |

## 红线 grep 例外清单（非榜单抓取，保留理由）

- `workflow-resources.ts` platforms（起点中文网/番茄小说/七猫免费）与 `CreateBookModal` 平台选项：**发布平台选择**，建书/作品定位核心功能，与数据抓取无关
- `defaults-workflow.ts` "起点状态/终点状态"：工作流阶段描述假阳性
- `ink.scss .rank-number`：码字统计数字样式类名假阳性
- `platformCategory*` 字段：工作流"小说类型"字段的实现载体，语义与榜单无关（数据源 platformCategories 已删除）

## 人工签核项

1. fork 仓库 tag `v1.0.9-lzc` 已在重提前推送（内容 = 本送审版本源码）
2. 商店描述/截图无榜单残留已人工复查
