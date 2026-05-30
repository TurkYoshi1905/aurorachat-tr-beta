#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  AuroraChat — GitHub Sync Script
#  Tüm değişiklikleri commit edip GitHub'a gönderir.
#  Kullanım: bash github-sync.sh [isteğe bağlı commit mesajı]
# ─────────────────────────────────────────────────────────────

set -e

VERSION="v1.2.7"
REMOTE="origin"
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

COMMIT_MSG="${1:-"release: AuroraChat $VERSION — $(date '+%d %b %Y')"}"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║        AuroraChat — GitHub Sync              ║"
echo "║  Sürüm : $VERSION                             ║"
echo "║  Dal   : $BRANCH                              ║"
echo "║  Zaman : $TIMESTAMP                           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Durum kontrolü ──────────────────────────────────────
echo "▶ [1/4] Değişiklikler kontrol ediliyor..."
CHANGED=$(git status --porcelain | wc -l)
if [ "$CHANGED" -eq 0 ]; then
  echo "  ✓ Gönderilek değişiklik yok — her şey güncel."
  exit 0
fi
echo "  → $CHANGED değiştirilmiş / yeni dosya bulundu."

# ── 2. Staging ─────────────────────────────────────────────
echo ""
echo "▶ [2/4] Tüm değişiklikler stage ediliyor..."
git add -A
echo "  ✓ git add -A tamamlandı."

# ── 3. Commit ──────────────────────────────────────────────
echo ""
echo "▶ [3/4] Commit oluşturuluyor..."
echo "  Mesaj: \"$COMMIT_MSG\""
git commit -m "$COMMIT_MSG"
echo "  ✓ Commit oluşturuldu."

# ── 4. Push ────────────────────────────────────────────────
echo ""
echo "▶ [4/4] GitHub'a gönderiliyor ($REMOTE/$BRANCH)..."
git push "$REMOTE" "$BRANCH"

echo ""
echo "══════════════════════════════════════════════"
echo "  ✅ Başarılı! Tüm değişiklikler GitHub'da."
echo "  🔗 https://github.com/TurkYoshi1905/aurorachat-tr-beta"
echo "══════════════════════════════════════════════"
echo ""
