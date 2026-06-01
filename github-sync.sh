#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  AuroraChat — GitHub Sync Script
#  Kullanım:
#    bash github-sync.sh push ["commit mesajı"]   → GitHub'a gönder
#    bash github-sync.sh pull                     → GitHub'dan çek
# ─────────────────────────────────────────────────────────────

set -e

MODE="${1:-push}"
COMMIT_MSG="${2:-Otomatik guncelleme: $(date '+%Y-%m-%d %H:%M')}"
REMOTE="origin"
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
WORKSPACE="/home/runner/workspace"

# GITHUB_PAT varsa remote URL'ye göm (HTTPS auth için)
if [ -n "$GITHUB_PAT" ]; then
  git remote set-url "$REMOTE" \
    "https://TurkYoshi1905:${GITHUB_PAT}@github.com/TurkYoshi1905/aurorachat-tr-beta.git"
fi

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║        AuroraChat — GitHub Sync              ║"
echo "║  Mod   : $MODE                               ║"
echo "║  Dal   : $BRANCH                             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ─── PUSH ────────────────────────────────────────────────────
if [ "$MODE" = "push" ]; then

  echo "▶ [1/3] Değişiklikler kontrol ediliyor..."
  CHANGED=$(git status --porcelain | wc -l)
  if [ "$CHANGED" -eq 0 ]; then
    echo "  ✓ Gönderilek değişiklik yok — her şey güncel."
    exit 0
  fi
  echo "  → $CHANGED değiştirilmiş / yeni dosya bulundu."

  echo ""
  echo "▶ [2/3] Stage ediliyor..."
  git add -A
  echo "  ✓ git add -A tamamlandı."

  echo ""
  echo "▶ [3/3] Commit & Push yapılıyor..."
  echo "  Mesaj: \"$COMMIT_MSG\""
  git commit -m "$COMMIT_MSG"
  git push "$REMOTE" "$BRANCH"

  echo ""
  echo "══════════════════════════════════════════════"
  echo "  ✅ Başarılı! Tüm değişiklikler GitHub'da."
  echo "  🔗 https://github.com/TurkYoshi1905/aurorachat-tr-beta"
  echo "══════════════════════════════════════════════"

# ─── PULL ────────────────────────────────────────────────────
elif [ "$MODE" = "pull" ]; then

  echo "▶ [1/2] GitHub'tan çekiliyor..."
  git pull "$REMOTE" "$BRANCH"

  echo ""
  echo "▶ [2/2] Dosyalar doğru konumda mı kontrol ediliyor..."
  if [ -d "$WORKSPACE/artifacts/aurorachat/src" ]; then
    echo "  ✓ artifacts/aurorachat/src/ mevcut — dosyalar doğru yerde."
  else
    echo "  ⚠ artifacts/aurorachat/src/ bulunamadı. Beklenmedik durum."
  fi

  echo ""
  echo "══════════════════════════════════════════════"
  echo "  ✅ GitHub'tan başarıyla çekildi."
  echo "══════════════════════════════════════════════"

else
  echo "Kullanım:"
  echo "  bash github-sync.sh push [\"commit mesajı\"]"
  echo "  bash github-sync.sh pull"
  exit 1
fi

# ─── Supabase Edge Functions Deploy ──────────────────────────
if [ "$MODE" = "push" ] && [ -n "$SUPABASE_ACCESS_TOKEN" ]; then
  echo ""
  echo "Supabase Edge Functions deploy ediliyor..."
  cd "$WORKSPACE"

  SUPA_BIN="/tmp/supabase_cli_bin"
  if [ ! -f "$SUPA_BIN" ]; then
    echo "  Supabase CLI indiriliyor..."
    curl -fsSL https://github.com/supabase/cli/releases/download/v2.15.8/supabase_linux_amd64.tar.gz \
      -o /tmp/supabase_cli.tar.gz 2>/dev/null
    tar -xzf /tmp/supabase_cli.tar.gz -C /tmp 2>/dev/null
    mv /tmp/supabase "$SUPA_BIN" 2>/dev/null || true
    chmod +x "$SUPA_BIN" 2>/dev/null
  fi

  SUPA_FUNCS="$WORKSPACE/.migration-backup/supabase/functions"
  if [ -d "$SUPA_FUNCS" ]; then
    for fn_dir in "$SUPA_FUNCS"/*/; do
      fn_name=$(basename "$fn_dir")
      echo "  -> $fn_name deploy ediliyor..."
      SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" "$SUPA_BIN" functions deploy "$fn_name" \
        --project-ref ktittqaubkaylprxnoya \
        --no-verify-jwt \
        --use-api \
        2>&1 | grep -E "Deployed|Error|error|failed"
    done
    echo "Supabase deploy tamamlandi!"
  fi
fi
