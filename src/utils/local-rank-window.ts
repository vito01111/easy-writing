import { isTauriRuntime } from '@/storage'

/**
 * 榜单渲染抓取的前端封装。
 *
 * 桌面端调 Rust 命令 rank_crawl_render_page：开一个不可见的真实浏览器窗口
 * 加载榜单页（起点 probe.js 反爬自然通过、cookie 由窗口会话自持），
 * 等目标选择器出现、按需滚动触发懒加载，拿回渲染后的完整 HTML。
 *
 * 懒猫微服网页端走随包服务端渲染（/api/render，DrissionPage + Chromium），
 * 同样是真实浏览器环境过反爬；开源网页版无此能力，给可读提示。
 */

export interface RankRenderCrawlOptions {
  /** 页面就绪的标志选择器（出现即认为内容已渲染） */
  waitSelector: string
  /** 懒加载滚动轮数；0 = 选择器出现即取（起点分页站不需要滚动） */
  scrollRounds?: number
  timeoutMs?: number
}

export const crawlRankPageViaWindow = async (url: string, options: RankRenderCrawlOptions): Promise<string> => {
  if (!isTauriRuntime()) {
    const { getWebProxyCapabilities, webProxyRenderPage } = await import('@/utils/web-proxy-fetch')
    const capabilities = await getWebProxyCapabilities()
    if (!capabilities?.render) {
      throw new Error('该榜单源需要真实浏览器渲染过反爬：请使用桌面客户端或懒猫微服部署版（番茄/七猫源网页端直连可用）')
    }
    const html = await webProxyRenderPage({
      url,
      waitSelector: options.waitSelector,
      scrollRounds: Math.max(0, Math.floor(options.scrollRounds || 0)),
      timeoutMs: options.timeoutMs,
    })
    if (!String(html || '').trim()) throw new Error('服务端渲染没有返回页面内容')
    return html
  }
  const { invoke } = await import('@tauri-apps/api/core')
  const html = await invoke<string>('rank_crawl_render_page', {
    request: {
      url,
      waitSelector: options.waitSelector,
      scrollRounds: Math.max(0, Math.floor(options.scrollRounds || 0)),
      timeoutMs: options.timeoutMs,
    },
  })
  if (!String(html || '').trim()) throw new Error('抓取窗口没有返回页面内容')
  return html
}
