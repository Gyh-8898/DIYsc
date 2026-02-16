@echo off
chcp 65001 >nul
setlocal

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "MP_DIR=%ROOT%\miniprogram"
set "DIST_DIR=%MP_DIR%\dist"
set "CACHE_DIR=%MP_DIR%\.swc"

echo ============================================
echo   小程序前端缓存清理 + 重新编译
echo ============================================
echo.

:: 1. 停止正在运行的 taro dev 进程
echo [1/5] 正在停止 Taro 编译进程...
taskkill /F /FI "WINDOWTITLE eq Taro*" >nul 2>nul
powershell -NoProfile -Command "Get-Process -Name 'node' -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'taro' } | Stop-Process -Force -ErrorAction SilentlyContinue" >nul 2>nul
echo       完成.

:: 2. 清理编译产物 (dist)
echo [2/5] 正在清理编译产物 (dist)...
if exist "%DIST_DIR%" (
  rd /s /q "%DIST_DIR%"
  echo       已删除 dist 目录.
) else (
  echo       dist 目录不存在, 跳过.
)

:: 3. 清理 .swc 缓存
echo [3/5] 正在清理 .swc 编译缓存...
if exist "%CACHE_DIR%" (
  rd /s /q "%CACHE_DIR%"
  echo       已删除 .swc 缓存.
) else (
  echo       .swc 缓存不存在, 跳过.
)

:: 4. 清理 node_modules/.cache (webpack 缓存)
echo [4/5] 正在清理 webpack 缓存...
if exist "%MP_DIR%\node_modules\.cache" (
  rd /s /q "%MP_DIR%\node_modules\.cache"
  echo       已删除 node_modules/.cache.
) else (
  echo       webpack 缓存不存在, 跳过.
)

:: 5. 重新启动编译
echo [5/5] 正在重新启动 Taro 编译 (dev:weapp)...
echo.
echo ============================================
echo   缓存已全部清理! 正在重新编译...
echo   编译完成后请在微信开发者工具中刷新预览
echo ============================================
echo.

cd /d "%MP_DIR%"
call npm.cmd run dev:weapp
