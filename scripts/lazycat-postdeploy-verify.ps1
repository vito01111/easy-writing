# 部署后验证：实例状态 + 容器健康 + 公网入口 smoke
# 用法: powershell -ExecutionPolicy Bypass -File scripts/lazycat-postdeploy-verify.ps1 [-PublicUrl <url>]
param(
  [string]$PublicUrl = "https://easywriting.vito.heiyu.space"
)
$ErrorActionPreference = "Continue"
$lazycatDir = Join-Path (Split-Path -Parent $PSScriptRoot) "lazycat"

Write-Host "==> project info (lazycat dir)"
Push-Location $lazycatDir
try {
  lzc-cli project info --log info
  $info = lzc-cli project info 2>&1 | Out-String
  if ($info -match "Status_Paused") {
    Write-Host "==> Status_Paused detected, starting..."
    lzc-cli project start --log debug
  }
} finally {
  Pop-Location
}

Write-Host "==> container logs (tail 50)"
Push-Location $lazycatDir
try {
  lzc-cli project log --follow=false --tail 50 --log info
} finally {
  Pop-Location
}

Write-Host "==> public URL smoke: $PublicUrl"
$code = curl.exe -s -o NUL -w "%{http_code}" --noproxy "*" $PublicUrl
Write-Host "HTTP $code (307 跳登录 = 鉴权层正常；200 = 已带登录态)"
