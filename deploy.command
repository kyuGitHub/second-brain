#!/bin/bash
# 더블클릭 실행 (Mac). 원본 볼트의 .md 로 그래프를 만들어 Supabase 비공개 저장소에 올린다.
# 노트 원문은 GitHub 에 올라가지 않는다.
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "[!] Node.js 가 없어요. https://nodejs.org 에서 LTS 버전을 설치해 주세요."; read -r; exit 1; }
echo "[1/4] 최신 프로그램을 받아요..."
command -v git >/dev/null && git pull --rebase --autostash
npm install --no-audit --no-fund >/dev/null
echo "[2/4] 원본 볼트에서 .md 파일을 가져와요..."
npm run sync || { read -r; exit 1; }
echo "[3/4] 그래프를 만들어요..."
echo "[4/4] Supabase 비공개 저장소에 올려요..."
if npm run upload; then echo "완료! 웹사이트에서 로그인 후 새로 고치면 바로 보여요."; else echo "[!] 올리기에 실패했어요. 위 메시지를 알려주세요."; fi
read -r -p "엔터를 누르면 창이 닫혀요."
