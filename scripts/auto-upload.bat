@echo off
rem 작업 스케줄러가 정해진 간격마다 실행: 최신 프로그램 받기 → .md 동기화 → 바뀐 노트가 있으면 업로드
chcp 65001 > nul
cd /d "%~dp0.."
set "LOG=%LOCALAPPDATA%\second-brain-upload.log"
echo ==== %date% %time% ==== >> "%LOG%"
where git > nul 2> nul
if not errorlevel 1 git pull -q --rebase --autostash >> "%LOG%" 2>&1
call node scripts\sync-vault.mjs >> "%LOG%" 2>&1
if errorlevel 1 exit /b 1
call node scripts\upload.mjs >> "%LOG%" 2>&1
