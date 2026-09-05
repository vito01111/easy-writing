import { createApp } from 'vue'
import { ElLoading } from 'element-plus'
import LazycatDriveDialog from './index.vue'
import type { LazycatDriveDialogOptions, LazycatDriveDialogResult } from '@/utils/lazycat-drive'

/**
 * 命令式打开懒猫网盘对话框（与 util 解耦：util 只依赖本启动器签名）。
 * 每次打开挂载独立实例，关闭即卸载；独立 app 实例要自带 v-loading 指令。
 */
export const openLazycatDriveDialog = (
  options: LazycatDriveDialogOptions
): Promise<LazycatDriveDialogResult> =>
  new Promise(resolve => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const app = createApp(LazycatDriveDialog, {
      ...options,
      onClose: (result: LazycatDriveDialogResult) => {
        resolve(result)
        app.unmount()
        container.remove()
      },
    })
    app.use(ElLoading)
    app.mount(container)
  })
