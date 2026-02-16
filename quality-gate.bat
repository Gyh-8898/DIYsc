@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Quality gate for C:\Users\Y\Desktop\ypw
REM - Keeps checks deterministic so repeated scans do not "discover new issues"
REM - Fails fast on build/type errors
REM - Treats npm audit network failures as warnings (so the gate is repeatable)

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo [INFO] Root: %ROOT%

where node.exe >nul 2>nul || (echo [ERROR] node.exe not found in PATH& exit /b 1)
where npm.cmd >nul 2>nul || (echo [ERROR] npm.cmd not found in PATH& exit /b 1)
where npx.cmd >nul 2>nul || (echo [ERROR] npx.cmd not found in PATH& exit /b 1)

REM Optional tools
where rg.exe >nul 2>nul
set "HAS_RG=%ERRORLEVEL%"

echo [STEP] Backend build
call npm.cmd --prefix "%ROOT%\backend" run build
if errorlevel 1 goto :error

echo [STEP] MiniProgram build weapp
call npm.cmd --prefix "%ROOT%\miniprogram" run build:weapp
if errorlevel 1 goto :error

echo [STEP] Admin H5 build
call npm.cmd --prefix "%ROOT%" run build:admin
if errorlevel 1 goto :error

echo [STEP] TypeScript typecheck root
call npx.cmd tsc --noEmit
if errorlevel 1 goto :error

echo [STEP] NPM audit high/critical only
call :audit_one "%ROOT%" "root"
if errorlevel 1 goto :error
call :audit_one "%ROOT%\backend" "backend"
if errorlevel 1 goto :error
call :audit_one "%ROOT%\miniprogram" "miniprogram"
if errorlevel 1 goto :error

if "%HAS_RG%"=="0" (
  echo [STEP] Static scans with ripgrep

  REM Fail if unsplash is referenced in runtime source
  rg -n "images\.unsplash\.com" backend\src miniprogram\src services components App.tsx index.tsx >nul 2>nul && (
    echo [ERROR] Found blocked external image host usage in runtime source.
    exit /b 1
  )

  REM Fail if known English notification titles remain
  rg -n "Order created|Payment successful|Order cancelled|Order completed|Order shipped|Withdrawal approved|Withdrawal rejected" backend\src >nul 2>nul && (
    echo [ERROR] Found English user-facing notification strings in backend source.
    exit /b 1
  )

  REM Fail if unsafe raw SQL string interpolation exists
  rg -n -F "WHERE \"id\" = '${" backend\src\services\points-admin.service.ts >nul 2>nul && (
    echo [ERROR] Found unsafe SQL string interpolation in points-admin.service.ts.
    exit /b 1
  )
  rg -n -F "WHERE \"id\"='${" backend\src\services\points-admin.service.ts >nul 2>nul && (
    echo [ERROR] Found unsafe SQL string interpolation in points-admin.service.ts.
    exit /b 1
  )

  REM Fail if JWT secret is read at import-time
  rg -n "const\s+JWT_SECRET\s*=\s*process\.env\.JWT_SECRET\s*\|\|\s*'dev_secret_key'" backend\src\middlewares\auth.middleware.ts >nul 2>nul && (
    echo [ERROR] Found import-time JWT_SECRET constant; must be runtime-evaluated.
    exit /b 1
  )
)

echo [DONE] Quality gate passed.
exit /b 0

:audit_one
set "P=%~1"
set "NAME=%~2"
set "LOG=%ROOT%\audit-%NAME%.log"
call npm.cmd --prefix "%P%" audit --omit=dev --audit-level=high >"%LOG%" 2>&1
if errorlevel 1 (
  REM If network fails, don't fail the gate; keep it deterministic.
  findstr /i /c:"Client network socket disconnected" /c:"audit endpoint returned an error" /c:"ECONNRESET" /c:"ETIMEDOUT" /c:"ENOTFOUND" "%LOG%" >nul
  if not errorlevel 1 (
    echo [WARN] npm audit %NAME% failed due to network; skipping.
    exit /b 0
  )

  echo [ERROR] npm audit %NAME% failed.
  type "%LOG%"
  exit /b 1
)
exit /b 0

:error
echo [ERROR] Quality gate failed.
exit /b 1
