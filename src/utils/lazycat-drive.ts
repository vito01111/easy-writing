/**
 * 懒猫网盘文件通道（应用侧显式通道）前端封装。
 *
 * 部署到懒猫微服时，随包服务把网盘挂载（RemoteFS，读）与应用文稿
 * （documents，写）暴露为同源 /api/lazycat/* 契约接口；导入走网盘
 * （用户心智：从我网盘里挑文件），导出/保存走应用文稿（长期保留）。
 *
 * - 可用性探测：GET /api/health 的 lazycatDrive 标志（服务端检查挂载根
 *   是否存在），桌面版 / 本地 dev / 开源网页版探测失败 → 全部入口隐藏，
 *   行为与上游完全一致（环境分流，见 lazycat-file-intercept 技能）。
 * - 用户隔离在服务端按 X-HC-User-ID 完成，前端不传用户参数。
 */

export interface LazycatDriveItem {
  name: string
  dir: boolean
  size?: number | null
  reachable?: boolean
}

export type LazycatDriveRoot = 'netdisk' | 'documents'

const HEALTH_URL = '/api/health'

let availabilityPromise: Promise<boolean> | null = null

/** 懒猫文件通道是否可用（结果按会话缓存） */
export const isLazycatDriveAvailable = (): Promise<boolean> => {
  if (!availabilityPromise) {
    availabilityPromise = window
      .fetch(HEALTH_URL)
      .then(r => (r.ok ? r.json() : null))
      .then(d => Boolean(d && d.lazycatDrive))
      .catch(() => false)
  }
  return availabilityPromise
}

export const listLazycatDir = async (
  root: LazycatDriveRoot,
  path: string
): Promise<{ ok: boolean; items: LazycatDriveItem[]; error?: string }> => {
  const query = new URLSearchParams({ root, path })
  const response = await window.fetch(`/api/lazycat/list?${query.toString()}`)
  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; items?: LazycatDriveItem[]; error?: string }
    | null
  if (!response.ok || !data) return { ok: false, items: [], error: `HTTP ${response.status}` }
  return { ok: Boolean(data.ok), items: data.items || [], error: data.error }
}

/** 读取网盘文件为 File 对象（与 <input type=file> 同型，复用既有导入管线） */
export const readLazycatFile = async (root: LazycatDriveRoot, path: string): Promise<File> => {
  const query = new URLSearchParams({ root, path })
  const response = await window.fetch(`/api/lazycat/file?${query.toString()}`)
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error || `读取失败（HTTP ${response.status}）`)
  }
  const blob = await response.blob()
  const name = path.split('/').pop() || 'file'
  return new File([blob], name)
}

/** 保存内容（base64 文本）到应用文稿；返回保存后的相对路径 */
export const saveLazycatFile = async (
  path: string,
  filename: string,
  contentBase64: string
): Promise<string> => {
  const response = await window.fetch('/api/lazycat/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root: 'documents', path, filename, contentBase64 }),
  })
  const data = (await response.json().catch(() => null)) as { ok?: boolean; path?: string; error?: string } | null
  if (!response.ok || !data?.ok) throw new Error(data?.error || `保存失败（HTTP ${response.status}）`)
  return data.path || filename
}

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  const chunkSize = 0x8000
  for (let start = 0; start < bytes.length; start += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize))
  }
  return btoa(binary)
}

/** Blob → base64（导出内容统一转码后走 save 通道） */
export const blobToBase64 = async (blob: Blob): Promise<string> =>
  bytesToBase64(new Uint8Array(await blob.arrayBuffer()))

export interface LazycatDriveDialogOptions {
  mode: 'open' | 'save'
  /** open 模式：允许选中的文件扩展名（含点号小写，如 ['.txt', '.json']）；空 = 不限 */
  accepts?: string[]
  /** save 模式：默认文件名 */
  filename?: string
  /** save 模式：待写入内容（base64） */
  contentBase64?: string
  /** 打开模式默认根（导入走网盘） */
  defaultRoot?: LazycatDriveRoot
}

export interface LazycatDriveDialogResult {
  /** open 模式选中文件时返回 */
  file?: File
  /** save 模式保存成功时返回相对路径 */
  savedPath?: string
  /** 用户是否完成了动作（false = 取消） */
  done: boolean
}

let dialogLauncher: ((options: LazycatDriveDialogOptions) => Promise<LazycatDriveDialogResult>) | null = null

/** 由对话框组件注册启动器（避免 util 直接依赖 Vue 组件） */
export const registerLazycatDriveDialog = (
  launcher: (options: LazycatDriveDialogOptions) => Promise<LazycatDriveDialogResult>
) => {
  dialogLauncher = launcher
}

const ensureLauncher = () => {
  if (dialogLauncher) return Promise.resolve(dialogLauncher)
  // 懒加载对话框组件（首次使用才拉起，避免拖慢启动）
  return import('@/components/LazycatDriveDialog/service').then(mod => {
    dialogLauncher = mod.openLazycatDriveDialog
    return dialogLauncher
  })
}

/** 打开"从懒猫网盘打开"对话框；取消返回 null */
export const pickFileFromLazycat = async (accepts?: string[]): Promise<File | null> => {
  const launcher = await ensureLauncher()
  const result = await launcher({ mode: 'open', accepts, defaultRoot: 'netdisk' })
  return result.file || null
}

/** 打开"保存到懒猫网盘"对话框；取消/失败返回 false */
export const saveBlobToLazycat = async (blob: Blob, filename: string): Promise<boolean> => {
  const launcher = await ensureLauncher()
  const contentBase64 = await blobToBase64(blob)
  const result = await launcher({ mode: 'save', filename, contentBase64, defaultRoot: 'documents' })
  if (!result.done || !result.savedPath) return false
  return true
}
