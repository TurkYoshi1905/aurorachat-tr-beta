#!/bin/bash

REPO_URL="https://TurkYoshi1905:${GITHUB_PAT}@github.com/TurkYoshi1905/aurorachat-tr-beta.git"
TEMP_DIR="/tmp/github_sync_$$"

echo "GitHub sync basliyor..."

mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

git init -q
git config user.email "asfurkan140@gmail.com"
git config user.name "TurkYoshi1905"

echo "Dosyalar hazirlaniyor..."
cd /home/runner/workspace
git archive HEAD | tar -x -C "$TEMP_DIR"

cd "$TEMP_DIR"

COMMIT_MSG="${1:-Otomatik guncelleme: $(date '+%Y-%m-%d %H:%M')}"

git add .
git commit -q -m "$COMMIT_MSG"

echo "GitHub'a yukleniyor..."
git push "$REPO_URL" main --force -q

echo "Tamamlandi! GitHub'a basariyla yuklendi."
echo "Repo: https://github.com/TurkYoshi1905/aurorachat-tr-beta"

rm -rf "$TEMP_DIR"
