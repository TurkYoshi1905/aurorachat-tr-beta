#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  AuroraChat — GitHub Sync Script (v2 — Flat Deploy)
#
#  Kullanım:
#    bash github-sync.sh push ["commit mesajı"]   → GitHub'a düz yapıyla gönder
#    bash github-sync.sh pull                     → GitHub'dan src/ çek
#
#  Nasıl çalışır (push):
#    1) Repo /tmp altına klonlanır — git geçmişi korunur.
#    2) Klonun içi temizlenir (git rm -rf .)
#    3) .migration-backup/ flat yapı kopyalanır (Vercel/GitHub uyumlu).
#    4) artifacts/aurorachat/src/ en güncel v1.2.9 kodlarıyla üzerine yazılır.
#    5) Commit + push → GitHub düz (flat) yapıyla güncellenir.
#
#  ÖNEMLİ: Bu script Replit monorepo yapısını GitHub'a GÖNDERMEZ.
#           Sadece gerçek uygulama dosyaları gönderilir.
# ─────────────────────────────────────────────────────────────────────────────

set -e

MODE="${1:-push}"
COMMIT_MSG="${2:-v1.2.9: context menu, mobile drawer profil kartı, RLS düzeltmeleri}"
BRANCH="main"
WORKSPACE="/home/runner/workspace"
MIGRATION_BACKUP="$WORKSPACE/.migration-backup"
AURORACHAT="$WORKSPACE/artifacts/aurorachat"
DEPLOY_TMP="/tmp/aurora-deploy-$$"

# GITHUB_PAT zorunlu
if [ -z "$GITHUB_PAT" ]; then
  echo "❌ GITHUB_PAT çevre değişkeni tanımlı değil."
  echo "   Replit Secrets'a GITHUB_PAT ekleyin ve tekrar deneyin."
  exit 1
fi

REPO_URL="https://TurkYoshi1905:${GITHUB_PAT}@github.com/TurkYoshi1905/aurorachat-tr-beta.git"

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║     AuroraChat — GitHub Sync  (Flat Deploy v2)     ║"
echo "║  Mod    : $MODE                                    ║"
echo "║  Dal    : $BRANCH                                  ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# ─── PUSH ────────────────────────────────────────────────────────────────────
if [ "$MODE" = "push" ]; then

  echo "▶ [1/5] GitHub deposu klonlanıyor (geçmiş korunuyor)..."
  rm -rf "$DEPLOY_TMP"
  git clone "$REPO_URL" "$DEPLOY_TMP" --quiet
  cd "$DEPLOY_TMP"
  git config user.name "TurkYoshi1905"
  git config user.email "165286969+TurkYoshi1905@users.noreply.github.com"
  echo "  ✓ Klonlandı."

  echo ""
  echo "▶ [2/5] Eski / yanlış dosyalar temizleniyor (git rm)..."
  git rm -rf . --quiet 2>/dev/null || true
  echo "  ✓ Temizlendi."

  echo ""
  echo "▶ [3/5] Flat yapı kopyalanıyor (.migration-backup → /)..."
  # node_modules ve .git hariç her şeyi kopyala
  for item in "$MIGRATION_BACKUP"/{*,.*}; do
    base=$(basename "$item")
    [ "$base" = "." ] || [ "$base" = ".." ] && continue
    [ "$base" = "node_modules" ] && continue
    [ "$base" = ".git" ] && continue
    [ "$base" = ".agents" ] && continue
    [ "$base" = "package-lock.json" ] && continue
    if [ -d "$item" ]; then
      cp -r "$item" "$DEPLOY_TMP/$base"
    else
      cp "$item" "$DEPLOY_TMP/$base"
    fi
  done
  echo "  ✓ Temel yapı kopyalandı (electron/, supabase/, scripts/, src-tauri/, vite.config.ts, vercel.json, ...)."

  echo ""
  echo "▶ [4/5] En güncel v1.2.9 kaynak kodları üzerine yazılıyor..."

  # src/ → artifacts/aurorachat/src/ ile tamamen değiştir (v1.2.9)
  rm -rf "$DEPLOY_TMP/src"
  cp -r "$AURORACHAT/src" "$DEPLOY_TMP/src"
  COMP_COUNT=$(ls "$DEPLOY_TMP/src/components/" 2>/dev/null | wc -l | tr -d ' ')
  echo "  ✓ src/ güncellendi ($COMP_COUNT bileşen, ContextMenu + profileCache + VoiceRecorder dahil)."

  # public/
  rm -rf "$DEPLOY_TMP/public"
  cp -r "$AURORACHAT/public" "$DEPLOY_TMP/public"
  echo "  ✓ public/ güncellendi."

  # index.html
  cp "$AURORACHAT/index.html" "$DEPLOY_TMP/index.html"
  echo "  ✓ index.html güncellendi."

  # components.json (shadcn/ui)
  cp "$AURORACHAT/components.json" "$DEPLOY_TMP/components.json"
  echo "  ✓ components.json güncellendi."

  # v1.2.9 SQL migration
  SQL_MIGRATION="$WORKSPACE/supabase/migrations/20260604000000_v129_voice_notes_rls.sql"
  if [ -f "$SQL_MIGRATION" ]; then
    mkdir -p "$DEPLOY_TMP/supabase/migrations"
    cp "$SQL_MIGRATION" "$DEPLOY_TMP/supabase/migrations/20260604000000_v129_voice_notes_rls.sql"
    echo "  ✓ SQL migration v1.2.9 eklendi (voice-notes RLS)."
  fi

  # github-sync.sh (bu scriptin kendi güncel kopyası)
  cp "$MIGRATION_BACKUP/github-sync.sh" "$DEPLOY_TMP/github-sync.sh"
  echo "  ✓ github-sync.sh güncellendi."

  # replit.md (proje dokümantasyonu)
  if [ -f "$WORKSPACE/replit.md" ]; then
    cp "$WORKSPACE/replit.md" "$DEPLOY_TMP/replit.md"
    echo "  ✓ replit.md eklendi."
  fi

  echo ""
  echo "▶ [5/5] Commit & Push yapılıyor..."
  cd "$DEPLOY_TMP"
  git add -A

  CHANGED=$(git status --porcelain | wc -l)
  if [ "$CHANGED" -eq 0 ]; then
    echo "  ✓ Gönderilecek değişiklik yok — her şey güncel."
  else
    echo "  → $CHANGED dosya güncellendi."
    git commit -m "$COMMIT_MSG"
    git push origin "$BRANCH"
    echo ""
    echo "════════════════════════════════════════════════════"
    echo "  ✅ Başarılı! GitHub flat yapıyla güncellendi."
    echo "  🔗 https://github.com/TurkYoshi1905/aurorachat-tr-beta"
    echo "  🚀 Vercel otomatik derlemeyi başlatacak."
    echo "════════════════════════════════════════════════════"
  fi

  # Temp dizini temizle
  cd "$WORKSPACE"
  rm -rf "$DEPLOY_TMP"
  echo "  ✓ Geçici dosyalar temizlendi."

# ─── PULL ────────────────────────────────────────────────────────────────────
elif [ "$MODE" = "pull" ]; then

  echo "▶ [1/2] GitHub deposu çekiliyor..."
  rm -rf "$DEPLOY_TMP"
  git clone --depth=1 "$REPO_URL" "$DEPLOY_TMP" --quiet
  echo "  ✓ Klonlandı."

  echo ""
  echo "▶ [2/2] src/ ve public/ aktarılıyor → artifacts/aurorachat/..."
  rm -rf "$AURORACHAT/src" && cp -r "$DEPLOY_TMP/src" "$AURORACHAT/src"
  rm -rf "$AURORACHAT/public" && cp -r "$DEPLOY_TMP/public" "$AURORACHAT/public"
  cp "$DEPLOY_TMP/index.html" "$AURORACHAT/index.html" 2>/dev/null || true

  cd "$WORKSPACE"
  rm -rf "$DEPLOY_TMP"

  echo ""
  echo "════════════════════════════════════════════════════"
  echo "  ✅ GitHub'tan başarıyla çekildi."
  echo "════════════════════════════════════════════════════"

else
  echo "Kullanım:"
  echo "  bash github-sync.sh push [\"commit mesajı\"]"
  echo "  bash github-sync.sh pull"
  exit 1
fi

# ─── Supabase Edge Functions Deploy (push modunda) ───────────────────────────
if [ "$MODE" = "push" ] && [ -n "$SUPABASE_ACCESS_TOKEN" ]; then
  echo ""
  echo "▶ Supabase Edge Functions deploy ediliyor..."

  SUPA_BIN="/tmp/supabase_cli_bin"
  if [ ! -f "$SUPA_BIN" ]; then
    echo "  Supabase CLI indiriliyor..."
    curl -fsSL https://github.com/supabase/cli/releases/download/v2.15.8/supabase_linux_amd64.tar.gz \
      -o /tmp/supabase_cli.tar.gz 2>/dev/null
    tar -xzf /tmp/supabase_cli.tar.gz -C /tmp 2>/dev/null
    mv /tmp/supabase "$SUPA_BIN" 2>/dev/null || true
    chmod +x "$SUPA_BIN" 2>/dev/null
  fi

  SUPA_FUNCS="$MIGRATION_BACKUP/supabase/functions"
  SUPA_CONFIG="$MIGRATION_BACKUP/supabase/config.toml"

  if [ ! -f "$SUPA_CONFIG" ]; then
    echo "  ⚠ Supabase config.toml bulunamadı: $SUPA_CONFIG — deploy atlandı."
  elif [ ! -d "$SUPA_FUNCS" ]; then
    echo "  ⚠ Supabase functions dizini bulunamadı: $SUPA_FUNCS — deploy atlandı."
  else
    cd "$MIGRATION_BACKUP"

    DEPLOY_ERRORS=0
    DEPLOY_OK=0

    set +e

    for fn_dir in "$SUPA_FUNCS"/*/; do
      fn_name=$(basename "$fn_dir")
      fn_file="$fn_dir/index.ts"

      if [ ! -f "$fn_file" ]; then
        echo "  ⚠ $fn_name — index.ts bulunamadı, atlandı."
        continue
      fi

      echo "  -> $fn_name deploy ediliyor..."
      OUTPUT=$(SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" "$SUPA_BIN" functions deploy "$fn_name" \
        --project-ref ktittqaubkaylprxnoya \
        --no-verify-jwt \
        --use-api \
        2>&1)
      EXIT_CODE=$?

      if [ $EXIT_CODE -eq 0 ]; then
        echo "     ✓ $fn_name deploy edildi."
        DEPLOY_OK=$((DEPLOY_OK + 1))
      else
        echo "     ✗ $fn_name hata: $(echo "$OUTPUT" | grep -E "Error|error|failed" | head -1)"
        DEPLOY_ERRORS=$((DEPLOY_ERRORS + 1))
      fi
    done

    set -e
    cd "$WORKSPACE"

    echo ""
    if [ $DEPLOY_ERRORS -eq 0 ]; then
      echo "  ✓ Supabase Edge Functions deploy tamamlandı ($DEPLOY_OK fonksiyon)."
    else
      echo "  ⚠ Deploy tamamlandı — $DEPLOY_OK başarılı, $DEPLOY_ERRORS hatalı."
    fi
  fi
fi
