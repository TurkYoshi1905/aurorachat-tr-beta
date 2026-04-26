#!/usr/bin/env bash
# AuroraChat — GitHub Sync Script
# Kullanım: bash scripts/github-sync.sh "Commit mesajı"
# Örnek:    bash scripts/github-sync.sh "chore: release v1.0.1"

set -e

REMOTE="https://github.com/TurkYoshi1905/aurorachat-tr-beta.git"
BRANCH="main"

# Commit mesajı argümanından al, yoksa varsayılan kullan
COMMIT_MSG="${1:-chore: sync from Replit}"

echo "=== AuroraChat GitHub Sync ==="
echo "Remote : $REMOTE"
echo "Branch : $BRANCH"
echo "Mesaj  : $COMMIT_MSG"
echo ""

# Git remote ayarla (yoksa ekle, varsa güncelle)
if git remote get-url origin &>/dev/null; then
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi

# Staging: tüm değişiklikleri ekle
git add -A

# Değişiklik yoksa çık
if git diff --cached --quiet; then
  echo "ℹ️  Commit edilecek değişiklik bulunamadı."
  exit 0
fi

# Commit
git commit -m "$COMMIT_MSG"

# Push
echo ""
echo "⬆️  GitHub'a gönderiliyor..."
git push -u origin "$BRANCH"

echo ""
echo "✅ Başarıyla senkronize edildi!"
echo "🔗 $REMOTE"
