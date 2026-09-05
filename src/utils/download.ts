const isTauriRuntime = () => {
  return typeof window !== 'undefined' && Boolean((window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ || (window as unknown as Record<string, unknown>).__TAURI__)
}

const getFileExtension = (filename: string) => {
  const match = String(filename || '').match(/\.([a-z0-9]+)$/i)
  return match?.[1]?.toLowerCase() || ''
}

const getFilterName = (extension: string) => {
  const value = extension.toLowerCase()
  if (value === 'txt') return 'TXT 文本'
  if (value === 'doc' || value === 'docx') return 'Word 文档'
  if (value === 'zip') return 'ZIP 压缩包'
  if (value === 'xlsx') return 'Excel 文件'
  if (value === 'json') return 'JSON 文件'
  if (value === 'png' || value === 'jpg' || value === 'jpeg' || value === 'webp') return '图片'
  return '文件'
}

const saveBlobInBrowser = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * 懒猫微服部署环境下的保存位置二选一。
 * confirm = 保存到懒猫网盘；cancel 按钮 = 保存到本机；右上角关闭 = 取消导出。
 */
const askLazycatOrLocal = async (filename: string): Promise<'lazycat' | 'local' | 'cancel'> => {
  const { ElMessageBox } = await import('element-plus')
  try {
    await ElMessageBox.confirm(`「${filename}」要保存到哪里？`, '导出文件', {
      confirmButtonText: '保存到懒猫网盘',
      cancelButtonText: '保存到本机',
      distinguishCancelAndClose: true,
      customClass: 'ink-confirm',
    })
    return 'lazycat'
  } catch (action) {
    return action === 'cancel' ? 'local' : 'cancel'
  }
}

export const saveBlobFile = async (blob: Blob, filename: string) => {
  if (!isTauriRuntime()) {
    // 懒猫微服部署环境：显式提供"保存到懒猫网盘"入口（文件拦截主干通道）
    const { isLazycatDriveAvailable } = await import('@/utils/lazycat-drive')
    if (await isLazycatDriveAvailable()) {
      const target = await askLazycatOrLocal(filename)
      if (target === 'cancel') return false
      if (target === 'lazycat') {
        const { saveBlobToLazycat } = await import('@/utils/lazycat-drive')
        return await saveBlobToLazycat(blob, filename)
      }
    }
    saveBlobInBrowser(blob, filename)
    return true
  }

  const extension = getFileExtension(filename)
  const { save } = await import('@tauri-apps/plugin-dialog')
  const { invoke } = await import('@tauri-apps/api/core')
  const filePath = await save({
    title: '保存导出文件',
    defaultPath: filename,
    filters: extension
      ? [{ name: getFilterName(extension), extensions: [extension] }]
      : undefined,
  })

  if (!filePath) return false

  const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()))
  await invoke('write_export_file', { filePath, bytes })
  return true
}
