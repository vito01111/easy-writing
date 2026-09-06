# Store 人工审核包：cloud.lazycat.app.easywriting

## 审核结论

- 状态：pending
- Review ID：--
- 版本：1.0.8
- LPK SHA256：`3eacba0a2d7ad9e4f55ad626108c5aa1cfd822f89a9bbb7628e4dc8fc7bcd9b5`

## 版本信息

- 要求最小系统版本：--
- 声明不支持的平台：android, ios
- 版本更新说明（中文，后台值）：首次上架：上游 v1.0.6 功能全量移植；新增懒猫网盘文件拦截（导入/导出）、服务端渲染榜单抓取（起点/番茄/七猫）、同源 AI 代理（密钥仅存浏览器本地）。（草稿，待提交后回读）

## 应用信息（简体中文）

- 应用名称：易创（草稿，待提交后回读）
- 应用包标识符：cloud.lazycat.app.easywriting
- 应用简介：纯本地优先的开源 AI 网文写作软件：小说创作、BYOK 直连 AI、自定义提示词（草稿，待提交后回读）
- 应用关键词：AI写作，网文，小说，写作工具，码字统计（草稿，待提交后回读）
- 应用描述：易创（easy-writing）是开源 AGPL-3.0 的本地优先 AI 网文写作软件，由长期线上运营的写作平台客户端改造而来。

原项目功能：TipTap 富文本写作台，卷/章目录树、边写边存、每章自动保留历史版本；书架多作品管理（分组/封面/TXT·JSON 导入导出/回收站）；参考资料五件套（大纲、角色关系图、设定、时间线、故事线）；码字统计与灵感速记；AI 辅助支持 BYOK 直连 DeepSeek、通义千问、智谱、OpenRouter 等 OpenAI 兼容渠道及本地 Ollama，提供划词润色、流式续写、妙笔对话、工作流一键建书、AI 封面与取名器；榜单风向内置番茄/起点/七猫适配器。

懒猫版新增：网页端开箱即用，数据按浏览器隔离存储；导出/导入接入懒猫网盘（保存到懒猫网盘、从懒猫网盘打开，按微服用户隔离）；榜单抓取经服务端真实浏览器渲染，起点/番茄/七猫在网页端可用；BYOK 密钥仅保存在浏览器本地，代理转发不落盘。（草稿，待提交后回读）
- 项目移植来源 URL 地址：https://github.com/yilujian/easy-writing（草稿，待提交后回读）
- 移植来源作者名称：yilujian（草稿，待提交后回读）

## 截图

### 桌面端

- support：True
- verified：True
- `../screenshots/pc-01-shelf.png` (2566x1196) remote=`--`
- `../screenshots/pc-02-writing.png` (2566x1196) remote=`--`
- `../screenshots/pc-03-rank.png` (2566x1196) remote=`--`
- `../screenshots/pc-04-models.png` (2566x1196) remote=`--`

### 移动端

- support：False
- verified：False
- 未上传移动端应用使用截图

## 人工核对项

- [needs_review] 中文应用信息：确认中文名称、简介、关键词、描述与后台提交页一致。
- [needs_review] 英文应用信息：确认英文资料完整，避免后台自动生成或空值。
- [needs_review] 版本更新说明：后台版本更新说明为空或与 store-submit 草稿不一致时，提交前需要人工确认是否补齐。
- [pass] 移动端截图与 unsupported_platforms：无移动端截图时，最终 LPK 必须声明 android 和 ios 不支持；支持移动端时必须有移动端截图。
- [pass] 桌面端截图：确认截图真实、无调试标记、代表主流程，并与后台远端截图数量一致。
- [pass] LazyCat 特性声明：确认描述里的 LazyCat 能力都有 manifest、代码或运行态证据支撑。
- [pass] 复审反馈闭环：确认通知中心退回项逐条关闭并附证据。

## 复审反馈

- 无
