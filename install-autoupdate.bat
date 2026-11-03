@echo off
rem 회사 Windows PC 에서 더블클릭: 정해진 간격마다 옵시디언 노트를 자동으로 올린다 (작업 스케줄러 사용)
rem 끄려면 uninstall-autoupdate.bat 을 더블클릭하세요.
chcp 65001 > nul
cd /d "%~dp0"
where node > nul 2> nul
if errorlevel 1 (
  echo [!] Node.js 가 없어요. https://nodejs.org 에서 LTS 버전을 설치해 주세요.
  pause
  exit /b
)
if not exist node_modules call npm install --no-audit --no-fund
echo ── 세컨브레인 자동 업로드 설정 ──
call node scripts\setup-env.mjs
if errorlevel 1 (
  pause
  exit /b
)
set "MIN="
set /p MIN=몇 분마다 올릴까요? (엔터 = 60): 
if "%MIN%"=="" set MIN=60
schtasks /Create /F /SC MINUTE /MO %MIN% /TN "SecondBrainUpload" /TR "\"%~dp0scripts\auto-upload.bat\"" > nul
if errorlevel 1 (
  echo [!] 작업 스케줄러 등록에 실패했어요. 회사 PC 정책으로 막혀 있을 수 있어요.
  pause
  exit /b
)
schtasks /Run /TN "SecondBrainUpload" > nul
echo.
echo ✔ 자동 업로드를 켰어요. %MIN%분마다 볼트를 확인하고, 바뀐 노트가 있을 때만 올려요.
echo   기록: %LOCALAPPDATA%\second-brain-upload.log
echo   주의: PC 가 켜져 있고 로그인돼 있을 때만 실행돼요. 옵시디언 앱이 켜져 있어야 싱크로 노트가 내려와요.
pause
