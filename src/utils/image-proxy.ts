/**
 * 图片取回工具。
 *
 * - data:/blob: 本身可直接使用（本地生图与封面的主路径，同源无跨域问题）；
 * - 远程地址（生图兜底存的图床 url 等）先尝试直接 fetch；被跨域拦下时改走
 *   同源代理（懒猫微服部署形态可用），代理也不可用则如实报错。
 */

/** data:/blob: 本身可直接使用，无需取图 */
const isLocalImageUrl = (url: string) => url.startsWith('data:') || url.startsWith('blob:')

/** 无需取回即可直接作为 img src / 背景图使用的地址 */
export const canDisplayImageDirectly = (url: string) => isLocalImageUrl(url)

/** 取回图片 blob；失败抛可读错误 */
export const fetchImageBlob = async (url: string): Promise<Blob> => {
  if (!url) throw new Error('图片地址无效')
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    // 直连被跨域拦下（网页端常态）时改走同源代理（懒猫微服部署形态可用）
    const { getWebProxyFetch } = await import('@/utils/web-proxy-fetch')
    const proxied = await getWebProxyFetch()
    if (!proxied) throw new Error('远程图片获取失败（可能已过期或受跨域限制）')
    try {
      response = await proxied(url, { method: 'GET' })
    } catch {
      throw new Error('远程图片获取失败（可能已过期或受跨域限制）')
    }
  }
  if (!response.ok) throw new Error('图片加载失败')
  return response.blob()
}

/** 取回图片并生成 objectURL（调用方负责 revokeObjectURL） */
const fetchImageObjectUrl = async (url: string) => {
  const blob = await fetchImageBlob(url)
  return URL.createObjectURL(blob)
}

/**
 * 取可用于 canvas 绘制的图片源。
 * data:/blob: 直接返回（revoke=false）；其余取回 blob 转 objectURL（revoke=true，调用方用完需释放）。
 */
export const getImageObjectSource = async (url: string): Promise<{ url: string; revoke: boolean }> => {
  if (!url || isLocalImageUrl(url)) {
    return { url, revoke: false }
  }
  const objectUrl = await fetchImageObjectUrl(url)
  return { url: objectUrl, revoke: true }
}
