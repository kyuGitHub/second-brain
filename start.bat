@echo off
chcp 65001 > nul
cd /d "%~dp0"
where node > nul 2> nul
if errorlevel 1 (
  echo [!] Node.js 가 없어요. https://nodejs.org 에서 LTS 버전을 설치해 주세요.
  pause
  exit /b
)
if not exist node_modules call npm install
echo 원본 볼트를 바로 읽어서 띄워요. 노트를 고치면 자동으로 반영돼요. 끄려면 이 창을 닫으세요.
call npm run dev:live
pause
