@echo off
chcp 65001 > nul
cd /d "%~dp0"
where git > nul 2> nul
if errorlevel 1 (
  echo [!] Git 이 없어요. https://git-scm.com 에서 설치해 주세요.
  pause
  exit /b
)
git config user.email > nul 2> nul
if not errorlevel 1 goto identity_ok
echo [!] Git 에 이름과 이메일이 설정돼 있지 않아요. 처음 한 번만 입력해 주세요.
set /p GNAME=GitHub 아이디: 
set /p GMAIL=GitHub 이메일: 
git config --global user.name "%GNAME%"
git config --global user.email "%GMAIL%"
:identity_ok
if not exist node_modules call npm install
echo [1/4] GitHub 의 최신 프로그램을 받아요...
git pull --rebase --autostash
echo [2/4] 원본 볼트에서 .md 파일을 가져와요...
call npm run sync
if errorlevel 1 (
  pause
  exit /b
)
echo [3/4] 바뀐 내용을 기록해요...
git add -A
git commit -m "노트 동기화 %date% %time:~0,5%"
if errorlevel 1 echo     바뀐 노트가 없거나 기록에 실패했어요. 위 메시지를 확인해 주세요.
echo [4/4] GitHub 에 올려요...
git push
if errorlevel 1 (
  echo [!] 올리기에 실패했어요. 위 메시지를 캡처해서 알려주세요.
) else (
  echo 완료! 1~2분 뒤 https://kyugithub.github.io/second-brain/ 에 반영돼요.
)
pause
