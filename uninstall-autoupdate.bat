@echo off
rem 회사 Windows PC 에서 더블클릭: 자동 업로드 끄기
chcp 65001 > nul
schtasks /Delete /F /TN "SecondBrainUpload" > nul 2> nul
echo ✔ 자동 업로드를 껐어요. (.env 는 그대로 두었어요)
pause
