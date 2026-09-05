# 安装最新的 LPK 包到默认 Box（lzc-cli box default）
# 用法: powershell -ExecutionPolicy Bypass -File scripts/lazycat-install-lpk.ps1 [-LpkPath <path>]
param(
  [string]$LpkPath = ""
)
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$lpkDir = Join-Path $repoRoot "lazycat\lpk"

if (-not $LpkPath) {
  $lpk = Get-ChildItem $lpkDir -Filter "*.lpk" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $lpk) { throw "No .lpk found in $lpkDir — run lazycat-build-lpk.ps1 first" }
  $LpkPath = $lpk.FullName
}

Write-Host "==> Installing $LpkPath"
lzc-cli lpk install $LpkPath --log info
if ($LASTEXITCODE -ne 0) {
  Write-Warning "ExitCode non-zero — Windows 下可能仍安装成功，用 lazycat-postdeploy-verify.ps1 复核"
}
