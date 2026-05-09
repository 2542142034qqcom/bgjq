@echo off
setlocal EnableExtensions

REM 推送脚本（双击运行）
REM 仓库根目录：当前 .bat 所在目录（site）

cd /d "%~dp0"

set "REMOTE_URL=https://github.com/2542142034qqcom/bgjq.git"

REM 1) 若未初始化 git 仓库则初始化并设置远程
if not exist ".git" (
  echo [i] 初始化 Git 仓库...
  git init
  if errorlevel 1 goto :error
)

REM 2) 确保远程 origin 存在且指向目标仓库
git remote get-url origin >nul 2>nul
if errorlevel 1 (
  echo [i] 添加远程 origin...
  git remote add origin "%REMOTE_URL%"
  if errorlevel 1 goto :error
) else (
  for /f "usebackq delims=" %%R in (`git remote get-url origin`) do set "CURRENT_REMOTE=%%R"
  if /i not "%CURRENT_REMOTE%"=="%REMOTE_URL%" (
    echo [i] 更新远程 origin...
    git remote set-url origin "%REMOTE_URL%"
    if errorlevel 1 goto :error
  )
)

REM 3) 切换/创建 main 分支
git rev-parse --verify main >nul 2>nul
if errorlevel 1 (
  git checkout -b main
) else (
  git checkout main
)
if errorlevel 1 goto :error

REM 4) 添加、提交、推送
echo [i] 添加变更...
git add -A
if errorlevel 1 goto :error

REM 如果没有变更，就直接退出
git diff --cached --quiet
if not errorlevel 1 (
  echo [i] 没有需要提交的变更。
  goto :done
)

set "MSG=update %date% %time%"
echo [i] 提交：%MSG%
git commit -m "%MSG%"
if errorlevel 1 goto :error

echo [i] 推送到 GitHub...
git push -u origin main
if errorlevel 1 goto :error

:done
echo.
echo [OK] 完成。
pause
exit /b 0

:error
echo.
echo [ERR] 失败，请复制窗口输出给我排查。
pause
exit /b 1
