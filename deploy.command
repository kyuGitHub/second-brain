#!/bin/bash
# 더블클릭 실행 (Mac). 원본 볼트의 .md 를 가져와 GitHub 에 올린다 → 사이트 자동 배포.
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
echo "[1/3] 원본 볼트에서 .md 파일을 가져와요..."
npm run sync || { read -r; exit 1; }
echo "[2/3] 바뀐 내용을 기록해요..."
git add -A
git commit -m "노트 동기화 $(date '+%Y-%m-%d %H:%M')" || echo "바뀐 노트가 없어요."
echo "[3/3] GitHub 에 올려요. 1~2분 뒤 사이트에 반영돼요."
git push
read -r -p "엔터를 누르면 창이 닫혀요."
