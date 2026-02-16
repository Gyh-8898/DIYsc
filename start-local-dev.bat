@echo off
setlocal EnableDelayedExpansion

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BACKEND_DIR=%ROOT%\backend"
set "ADMIN_URL=http://127.0.0.1:5173"
set "PRISMA_MAX_RETRY=3"

echo [INFO] Project root: %ROOT%

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm.cmd was not found in PATH.
  echo Please install Node.js first.
  pause
  exit /b 1
)

if not exist "%ROOT%\node_modules" (
  echo [INFO] Installing root dependencies...
  call npm.cmd install
  if errorlevel 1 goto :error
)

if not exist "%BACKEND_DIR%\node_modules" (
  echo [INFO] Installing backend dependencies...
  call npm.cmd --prefix "%BACKEND_DIR%" install
  if errorlevel 1 goto :error
)

echo [INFO] Stopping stale backend node processes...
powershell -NoProfile -Command "$backend = [Regex]::Escape($env:BACKEND_DIR); Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -and $_.CommandLine -match $backend -and ($_.CommandLine -match 'ts-node-dev' -or $_.CommandLine -match 'prisma') } | ForEach-Object { Write-Host ('[INFO] Stopping backend node process (PID ' + $_.ProcessId + ')...'); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; exit 0"
if errorlevel 1 goto :error

echo [INFO] Releasing port 3001 if occupied...
powershell -NoProfile -Command "$conn = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue; if ($conn) { $procIds = $conn | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($procId in $procIds) { Write-Host ('[INFO] Stopping process on port 3001 (PID ' + $procId + ')...'); Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue } }; exit 0"

echo [INFO] Releasing port 5173 if occupied...
powershell -NoProfile -Command "$conn = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue; if ($conn) { $procIds = $conn | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($procId in $procIds) { Write-Host ('[INFO] Stopping process on port 5173 (PID ' + $procId + ')...'); Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue } }; exit 0"

echo [INFO] Syncing Prisma schema...
set /a PRISMA_TRY=1
:prisma_generate_retry
echo [INFO] Prisma generate attempt !PRISMA_TRY!/%PRISMA_MAX_RETRY%...
call npm.cmd --prefix "%BACKEND_DIR%" run prisma:generate
if errorlevel 1 (
  echo [WARN] prisma:generate failed on attempt !PRISMA_TRY!.
  echo [INFO] Cleaning temporary Prisma engine files...
  powershell -NoProfile -Command "$base = Join-Path $env:BACKEND_DIR 'node_modules\.prisma\client'; if (Test-Path $base) { Get-ChildItem -Path $base -Filter 'query_engine-windows.dll.node.tmp*' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue }; exit 0"
  if !PRISMA_TRY! GEQ %PRISMA_MAX_RETRY% goto :error
  set /a PRISMA_TRY+=1
  timeout /t 2 >nul
  goto :prisma_generate_retry
)

call npm.cmd --prefix "%BACKEND_DIR%" run prisma:push
if errorlevel 1 goto :error

if not exist "%BACKEND_DIR%\prisma\dev.db" (
  echo [INFO] Initializing backend seed data...
  call npm.cmd --prefix "%BACKEND_DIR%" run prisma:seed
  if errorlevel 1 goto :error
)

echo [INFO] Starting backend at http://localhost:3001 ...
start "Gem Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && npm.cmd run dev"

echo [INFO] Starting Admin H5 at http://localhost:5173 ...
start "Gem Admin H5" cmd /k "cd /d ""%ROOT%"" && npm.cmd run dev:admin"

echo [INFO] Waiting for Admin H5 startup...
set /a ADMIN_WAIT=0
:wait_admin_ready
powershell -NoProfile -Command "try { $client = New-Object Net.Sockets.TcpClient('127.0.0.1', 5173); $client.Close(); exit 0 } catch { exit 1 }"
if not errorlevel 1 goto :open_admin
set /a ADMIN_WAIT+=1
if !ADMIN_WAIT! GEQ 20 goto :open_admin
timeout /t 1 >nul
goto :wait_admin_ready

:open_admin
echo [INFO] Opening admin page in browser...
echo [INFO] Admin URL: %ADMIN_URL%
start "" "%ADMIN_URL%" >nul 2>nul
if errorlevel 1 (
  echo [WARN] start command failed, trying explorer fallback...
  explorer "%ADMIN_URL%"
)

echo [DONE] Local environment started.
exit /b 0

:error
echo [ERROR] Startup failed. Please check logs above.
pause
exit /b 1
