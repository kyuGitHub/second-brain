#!/bin/bash
# 더블클릭 실행 (Mac). 원본 볼트를 바로 읽어서 띄운다.
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "[!] Node.js 가 없어요. https://nodejs.org 에서 LTS 버전을 설치해 주세요."; read -r; exit 1; }
[ -d node_modules ] || npm install
npm run dev:live
