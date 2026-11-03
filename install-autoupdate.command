#!/bin/bash
# 집 Mac 에서 더블클릭: 정해진 간격마다 옵시디언 노트를 자동으로 올린다 (macOS launchd 사용)
# 끄려면 uninstall-autoupdate.command 를 더블클릭하세요.
cd "$(dirname "$0")" || exit 1
DIR="$(pwd)"
NODE="$(command -v node)"
GIT="$(command -v git)"
if [ -z "$NODE" ]; then echo "[!] Node.js 가 없어요. https://nodejs.org 에서 LTS 버전을 설치해 주세요."; read -r; exit 1; fi
[ -d node_modules ] || npm install --no-audit --no-fund

echo "── 세컨브레인 자동 업로드 설정 ──"
# 1) 로그인 정보 (사람 없이 올리려면 필요, .env 는 Git 에 안 올라가요)
"$NODE" scripts/setup-env.mjs || { read -r; exit 1; }
# 2) Mac 의 볼트 경로 (config.local.json 에 저장, Git 에 안 올라가요)
SRC="$("$NODE" -e "const fs=require('fs');let c=require('./config.json');try{Object.assign(c,require('./config.local.json'))}catch{}console.log(c.sourcePath||'')")"
if [ ! -d "$SRC" ]; then
  echo "옵시디언 볼트 폴더를 찾을 수 없어요: $SRC"
  read -r -p "Mac 의 볼트 폴더 경로 (Finder 에서 폴더를 이 창에 끌어다 놓아도 돼요): " SRC
  SRC="${SRC%/}"; SRC="${SRC//\\ / }"; SRC="${SRC%\"}"; SRC="${SRC#\"}"
  [ -d "$SRC" ] || { echo "[!] 폴더가 없어요: $SRC"; read -r; exit 1; }
  "$NODE" -e "require('fs').writeFileSync('config.local.json', JSON.stringify({sourcePath: process.argv[1]}, null, 2) + '\n')" "$SRC"
fi
# 3) 간격
read -r -p "몇 분마다 올릴까요? (엔터 = 60분): " MIN; MIN=${MIN:-60}
case "$MIN" in ''|*[!0-9]*) MIN=60;; esac

LABEL=com.ris.secondbrain.upload
PL="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/second-brain-upload.log"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
JOB="cd '$DIR' && echo \"── \$(date '+%Y-%m-%d %H:%M') ──\" && { [ -n '$GIT' ] && '$GIT' pull -q --rebase --autostash || true; } && '$NODE' scripts/sync-vault.mjs && '$NODE' scripts/upload.mjs"
# plist(XML) 안에 넣으려면 & < > 를 바꿔 적어야 한다
JOB_XML="${JOB//&/&amp;}"; JOB_XML="${JOB_XML//</&lt;}"; JOB_XML="${JOB_XML//>/&gt;}"
cat > "$PL" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>-lc</string><string>$JOB_XML</string></array>
  <key>StartInterval</key><integer>$((MIN * 60))</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict></plist>
PLIST
launchctl unload "$PL" 2>/dev/null
launchctl load "$PL"
echo
echo "✔ 자동 업로드를 켰어요. ${MIN}분마다 볼트를 확인하고, 바뀐 노트가 있을 때만 올려요."
echo "  기록: $LOG  (터미널에서: tail -f \"$LOG\")"
echo "  주의: 옵시디언 앱이 켜져 있어야 싱크로 노트가 내려와요. Mac 이 잠자기면 실행되지 않아요."
read -r -p "엔터를 누르면 창이 닫혀요."
