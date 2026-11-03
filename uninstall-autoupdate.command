#!/bin/bash
# 집 Mac 에서 더블클릭: 자동 업로드 끄기
PL="$HOME/Library/LaunchAgents/com.ris.secondbrain.upload.plist"
launchctl unload "$PL" 2>/dev/null
rm -f "$PL"
echo "✔ 자동 업로드를 껐어요. (.env 와 config.local.json 은 그대로 두었어요)"
read -r -p "엔터를 누르면 창이 닫혀요."
