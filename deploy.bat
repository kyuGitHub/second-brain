@echo off
chcp 65001 > nul
cd /d "%~dp0"
where node > nul 2> nul
if errorlevel 1 (
  echo [!] Node.js 가 없어요. https://nodejs.org 에서 LTS 버전을 설치해 주세요.
  pause
  exit /b
)
if exist .env goto env_ok
copy .env.example .env > nul
echo [!] 처음 한 번 설정이 필요해요. 메모장에서 .env 의 값을 채우고 저장한 뒤 다시 실행해 주세요.
notepad .env
pause
exit /b
:env_ok
echo [1/4] 최신 프로그램을 받아요...
where git > nul 2> nul
if not errorlevel 1 git pull --rebase --autostash
call npm install --no-audit --no-fund > nul
echo [2/4] 원본 볼트에서 .md 파일을 가져와요...
call npm run sync
if errorlevel 1 (
  pause
  exit /b
)
echo [3/4] 그래프를 만들어요...
echo [4/4] Supabase 비공개 저장소에 올려요...
call npm run upload
if errorlevel 1 (
  echo [!] 올리기에 실패했어요. 위 메시지를 캡처해서 알려주세요.
) else (
  echo 완료! 웹사이트에서 로그인 후 새로 고치면 바로 보여요.
  echo 노트 원문은 GitHub 에 올라가지 않아요.
)
pause
