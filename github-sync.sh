#!/bin/bash

# Değişkenler
REPO_URL="https://TurkYoshi1905:${GITHUB_PAT}@github.com/TurkYoshi1905/aurorachat-tr-beta.git"
TEMP_DIR="/tmp/github_sync_$$"
WORKSPACE="/home/runner/workspace"
ARTIFACT="$WORKSPACE/artifacts/aurorachat"
BACKUP="$WORKSPACE/.migration-backup"

echo "GitHub sync basliyor..."

# Geçici dizini temizle ve depoyu CLONE et
rm -rf "$TEMP_DIR"
git clone "$REPO_URL" "$TEMP_DIR"
cd "$TEMP_DIR"

# Git kullanıcı ayarlarını yap
git config user.email "asfurkan140@gmail.com"
git config user.name "TurkYoshi1905"

echo "Dosyalar guncelleniyor..."

# Ana kaynak klasörlerini kopyala (Replit'te artifacts/aurorachat/ altında)
cp -r "$ARTIFACT/src"    "$TEMP_DIR/"
cp -r "$ARTIFACT/public" "$TEMP_DIR/"

# Yalnızca migration backup'ta bulunan klasörler
cp -r "$BACKUP/supabase"  "$TEMP_DIR/" 2>/dev/null || true
cp -r "$BACKUP/src-tauri" "$TEMP_DIR/" 2>/dev/null || true
cp -r "$BACKUP/electron"  "$TEMP_DIR/" 2>/dev/null || true
cp -r "$BACKUP/.github"   "$TEMP_DIR/" 2>/dev/null || true
cp -r "$BACKUP/scripts"   "$TEMP_DIR/scripts-src" 2>/dev/null || true

# Artifact içindeki aktif config dosyaları (Replit'te düzenlenenler)
for f in \
  index.html \
  components.json \
  postcss.config.js \
  tailwind.config.ts \
  tsconfig.json; do
  [ -f "$ARTIFACT/$f" ] && cp "$ARTIFACT/$f" "$TEMP_DIR/$f"
done

# Backup'taki config dosyaları (GitHub yapısına özgü, Replit'te değişmeyenler)
for f in \
  package.json \
  package-lock.json \
  vite.config.ts \
  tsconfig.app.json \
  tsconfig.node.json \
  eslint.config.js \
  netlify.toml \
  CHANGELOG.md \
  README.md \
  .gitignore \
  .gitattributes \
  nativefier.json \
  electron-builder.json \
  build-electron.sh \
  playwright.config.ts \
  playwright-fixture.ts \
  vitest.config.ts; do
  [ -f "$BACKUP/$f" ] && cp "$BACKUP/$f" "$TEMP_DIR/$f"
done

# Bu sync scriptinin kendisini de kopyala (workspace kökündeki güncel hali)
[ -f "$WORKSPACE/github-sync.sh" ] && cp "$WORKSPACE/github-sync.sh" "$TEMP_DIR/github-sync.sh"

COMMIT_MSG="${1:-Otomatik guncelleme: $(date '+%Y-%m-%d %H:%M')}"

# Değişiklikleri ekle ve commitle
git add -A
git diff-index --quiet HEAD || git commit -m "$COMMIT_MSG"

echo "GitHub'a yukleniyor..."
git push origin main

STATUS=$?
if [ $STATUS -eq 0 ]; then
  echo ""
  echo "Tamamlandi! GitHub'a basariyla yuklendi."
  echo "Repo: https://github.com/TurkYoshi1905/aurorachat-tr-beta"
else
  echo ""
  echo "HATA: Push basarisiz oldu! (Cikis kodu: $STATUS)"
fi

# Temizlik
rm -rf "$TEMP_DIR"

# --- Supabase Bölümü ---
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

for fn_dir in "$BACKUP/supabase/functions"/*/; do
  fn_name=$(basename "$fn_dir")
  echo "  -> $fn_name deploy ediliyor..."
  SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" "$SUPA_BIN" functions deploy "$fn_name" \
    --project-ref ktittqaubkaylprxnoya \
    --no-verify-jwt \
    --use-api \
    2>&1 | grep -E "Deployed|Error|error|failed"
done

echo "Supabase deploy tamamlandi!"
