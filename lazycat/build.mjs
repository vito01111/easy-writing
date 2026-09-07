// 易创 · 懒猫微服 LPK 构建编排：
// 1. 前端预构建（pnpm build，与桌面版共用同一套产物）；
// 2. 组装 Box 侧镜像构建上下文——远程 build-pack 只传上下文根目录的
//    flat 白名单文件，dist/ 目录与 server.mjs 必须打成 tar 带入，
//    Dockerfile 里再解开（见 lazycat-lpk-builder 技能 build-spec）。
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const distDir = join(repoRoot, 'dist')
const contextDir = join(here, '.build-context')
const outDir = join(here, 'lpk')

const run = (command, args, cwd) => {
  console.log(`==> ${command} ${args.join(' ')} (cwd: ${cwd})`)
  execFileSync(command, args, { stdio: 'inherit', cwd, shell: process.platform === 'win32' })
}

if (process.env.EW_SKIP_FRONTEND_BUILD === '1') {
  console.log('==> EW_SKIP_FRONTEND_BUILD=1，跳过前端构建，直接复用现有 dist/')
} else {
  run('pnpm', ['install', '--frozen-lockfile'], repoRoot)
  run('pnpm', ['run', 'build'], repoRoot)
}
if (!existsSync(join(distDir, 'index.html'))) {
  throw new Error(`前端构建产物缺失：${distDir}（先在仓库根目录跑 pnpm build）`)
}

rmSync(contextDir, { recursive: true, force: true })
mkdirSync(contextDir, { recursive: true })
mkdirSync(outDir, { recursive: true })

// -f 用相对路径（cwd=contextDir）：Windows 下 GNU tar 会把 "D:\..." 的盘符
// 冒号当远程主机语法（tar: Cannot connect to D: resolve failed），bsdtar 则没有
// --force-local 选项；相对 -f 名两家的行为一致
run('tar', ['-cf', 'dist.tar', '-C', distDir, '.'], contextDir)
run('tar', ['-cf', 'server.tar', '-C', here, 'server.mjs'], contextDir)

console.log('==> build context ready at .build-context/ (dist.tar + server.tar)')
