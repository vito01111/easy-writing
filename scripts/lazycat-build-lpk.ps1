# 构建懒猫微服 LPK 包（前端本机预构建 + Box 侧组装运行镜像，产物输出到 lazycat/lpk/）
# 用法: powershell -ExecutionPolicy Bypass -File scripts/lazycat-build-lpk.ps1
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$lazycatDir = Join-Path $repoRoot "lazycat"

Write-Host "==> Building LPK in $lazycatDir"
Push-Location $lazycatDir
try {
  node build.mjs
  if ($LASTEXITCODE -ne 0) { throw "build.mjs staging failed" }
  lzc-cli project build --log info
  if ($LASTEXITCODE -ne 0) { throw "lzc-cli project build failed" }
} finally {
  Pop-Location
}

$lpk = Get-ChildItem (Join-Path $lazycatDir "lpk") -Filter "*.lpk" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($lpk) {
  Write-Host "==> LPK built: $($lpk.FullName) ($([math]::Round($lpk.Length/1MB,1)) MB)"
} else {
  Write-Warning "No .lpk found in lazycat/lpk — check build output above (Windows 下空 ExitCode 不一定代表失败)"
}
