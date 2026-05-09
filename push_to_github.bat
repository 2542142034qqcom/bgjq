@echo off
chcp 65001 >nul
title Push to GitHub
setlocal EnableExtensions

REM Push script (double click to run)
REM Repo root: current .bat directory (site)

cd /d "%~dp0"

set "REMOTE_URL=https://github.com/2542142034qqcom/bgjq.git"

REM 1) Init git repo if missing
if not exist ".git" (
  echo [i] Initializing Git repository...
  git init
  if errorlevel 1 goto :error
)

REM 2) Ensure origin remote points to target
git remote get-url origin >nul 2>nul
if errorlevel 1 (
  echo [i] Adding remote origin...
  git remote add origin "%REMOTE_URL%"
  if errorlevel 1 goto :error
) else (
  for /f "usebackq delims=" %%R in (`git remote get-url origin`) do set "CURRENT_REMOTE=%%R"
  if /i not "%CURRENT_REMOTE%"=="%REMOTE_URL%" (
    echo [i] Updating remote origin...
    git remote set-url origin "%REMOTE_URL%"
    if errorlevel 1 goto :error
  )
)

REM 3) Checkout/create main branch
git rev-parse --verify main >nul 2>nul
if errorlevel 1 (
  git checkout -b main
) else (
  git checkout main
)
if errorlevel 1 goto :error

REM 4) Add, commit, push
echo [i] Staging changes...
git add -A
if errorlevel 1 goto :error

REM If nothing to commit, still try pushing (in case previous push failed)
git diff --cached --quiet
if not errorlevel 1 (
  echo [i] Nothing to commit.
  goto :push
)

set "MSG=update %date% %time%"
echo [i] Commit message: %MSG%
git commit -m "%MSG%"
if errorlevel 1 goto :error

:push
echo [i] Pushing to GitHub...
git push -u origin main
if errorlevel 1 goto :error

:done
echo.
echo [OK] Done.
pause
exit /b 0

:error
echo.
echo [ERR] Failed. Please copy the output here.
pause
exit /b 1
