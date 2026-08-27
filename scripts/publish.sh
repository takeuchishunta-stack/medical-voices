#!/usr/bin/env bash
# Medical Voices 公開スクリプト。
#   使い方: ./scripts/publish.sh "変更内容のメモ"
# 検証 → コミット → GitHub に push まで一括で行う。
# main ブランチに push すると Netlify が本番サイトを自動で更新する。

set -euo pipefail

cd "$(dirname "$0")/.."

MESSAGE="${1:-サイト更新}"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "▶ CSS/JS の版番号を更新中..."
node scripts/stamp-assets.mjs

echo
echo "▶ サイトを検証中..."
node scripts/check-site.mjs

if [ -z "$(git status --porcelain)" ]; then
  echo "▶ 変更はありません。公開する内容がないので終了します。"
  exit 0
fi

echo
echo "▶ 変更ファイル:"
git status --short

if [ "$BRANCH" != "main" ]; then
  echo
  echo "※ 現在のブランチは '$BRANCH' です。本番サイトが更新されるのは main への push のみです。"
fi

echo
echo "▶ コミット中... (ブランチ: $BRANCH)"
git add -A
git commit -m "$MESSAGE"

echo
echo "▶ GitHub に push 中..."
delay=2
for attempt in 1 2 3 4 5; do
  if git push -u origin "$BRANCH"; then
    echo
    if [ "$BRANCH" = "main" ]; then
      echo "✓ push 完了。Netlify が本番サイトの更新を開始します。"
    else
      echo "✓ push 完了。（本番反映には main への push が必要です）"
    fi
    exit 0
  fi
  if [ "$attempt" -lt 5 ]; then
    echo "  push に失敗しました。${delay}秒待って再試行します (${attempt}/4)..."
    sleep "$delay"
    delay=$((delay * 2))
  fi
done

echo
echo "✗ push に失敗しました。ネットワーク状況を確認してから再実行してください。" >&2
exit 1
