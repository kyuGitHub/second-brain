@echo off
chcp 65001 > nul
cd /d "%~dp0"
where git > nul 2> nul
if errorlevel 1 (
  echo [!] Git 이 없어요. https://git-scm.com 에서 설치해 주세요.
  pause
  exit /b
)
if not exist node_modules call npm install
echo [1/3] 원본 볼트에서 .md 파일을 가져와요...
call npm run sync
if errorlevel 1 (
  pause
  exit /b
)
echo [2/3] 바뀐 내용을 기록해요...
git add -A
git commit -m "노트 동기화 %date% %time:~0,5%"
echo [3/3] GitHub 에 올려요. 1~2분 뒤 사이트에 반영돼요.
git push
pause
