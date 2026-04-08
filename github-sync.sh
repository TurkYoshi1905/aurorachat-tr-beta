#!/bin/bash

REPO_URL="https://TurkYoshi1905:${GITHUB_PAT}@github.com/TurkYoshi1905/aurorachat-tr-beta.git"
TEMP_DIR="/tmp/github_sync_$$"
WORKSPACE="/home/runner/workspace"

echo "GitHub sync basliyor..."

rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

git init -b main
git config user.email "asfurkan140@gmail.com"
git config user.name "TurkYoshi1905"

echo "Dosyalar hazirlaniyor..."

cp -r "$WORKSPACE/src"      "$TEMP_DIR/"
cp -r "$WORKSPACE/public"   "$TEMP_DIR/"
cp -r "$WORKSPACE/supabase" "$TEMP_DIR/"
cp -r "$WORKSPACE/electron" "$TEMP_DIR/"

for f in \
  package.json package-lock.json index.html vite.config.ts tailwind.config.ts \
  tsconfig.json tsconfig.app.json tsconfig.node.json \
  postcss.config.js eslint.config.js components.json \
  netlify.toml CHANGELOG.md README.md replit.md \
  .gitignore .gitattributes nativefier.json electron-builder.json \
  build-electron.sh github-sync.sh playwright.config.ts \
  playwright-fixture.ts vitest.config.ts; do
  [ -f "$WORKSPACE/$f" ] && cp "$WORKSPACE/$f" "$TEMP_DIR/$f"
done

COMMIT_MSG="${1:-Otomatik guncelleme: $(date '+%Y-%m-%d %H:%M')}"

git add -A
git commit -m "$COMMIT_MSG"

echo "GitHub'a yukleniyor..."
git push "$REPO_URL" main --force

STATUS=$?
if [ $STATUS -eq 0 ]; then
  echo ""
  echo "Tamamlandi! GitHub'a basariyla yuklendi."
  echo "Repo: https://github.com/TurkYoshi1905/aurorachat-tr-beta"
else
  echo ""
  echo "HATA: Push basarisiz oldu! (Cikis kodu: $STATUS)"
fi

rm -rf "$TEMP_DIR"

# Supabase Edge Functions'lari deploy et
echo ""
echo "Supabase Edge Functions deploy ediliyor..."
cd "$WORKSPACE"

for fn_dir in supabase/functions/*/; do
  fn_name=$(basename "$fn_dir")
  echo "  -> $fn_name deploy ediliyor..."
  supabase functions deploy "$fn_name" \
    --project-ref ktittqaubkaylprxnoya \
    --no-verify-jwt \
    --use-api \
    2>&1 | grep -E "Deployed|Error|error|failed"
done

echo "Supabase deploy tamamlandi!"
