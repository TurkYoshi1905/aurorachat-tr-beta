#!/bin/bash
# ============================================================
# AuroraChat — Anında Yedek Al (Yerel Script)
# Kullanım: bash scripts/backup-now.sh [etiket]
# Örnek:    bash scripts/backup-now.sh onemli_guncelleme
# ============================================================

set -e

DB_HOST="db.ktittqaubkaylprxnoya.supabase.co"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="postgres"
BACKUP_DIR="./local-backups"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║   AuroraChat Supabase Anlık Yedek   ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# pg_dump kontrolü
if ! command -v pg_dump &> /dev/null; then
  echo -e "${RED}❌ pg_dump bulunamadı. postgresql-client kurun.${NC}"
  exit 1
fi

# Şifre
if [ -z "$PGPASSWORD" ]; then
  echo -e "🔐 Supabase veritabanı şifresi:"
  read -s PGPASSWORD
  export PGPASSWORD
fi

LABEL="${1:-manuel}"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME="backup_${TIMESTAMP}_${LABEL}.dump"

mkdir -p "$BACKUP_DIR"

echo -e "${CYAN}🗄️  pg_dump başlıyor...${NC}"

pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  --no-privileges \
  -F c \
  -Z 6 \
  -f "${BACKUP_DIR}/${FILENAME}"

SIZE=$(du -sh "${BACKUP_DIR}/${FILENAME}" | cut -f1)

echo ""
echo -e "${GREEN}${BOLD}✅ Yedek alındı!${NC}"
echo -e "   📁 Dosya : ${BACKUP_DIR}/${FILENAME}"
echo -e "   📦 Boyut : ${SIZE}"
echo -e "   📅 Tarih : $(date '+%d.%m.%Y %H:%M')"
echo ""
echo -e "GitHub'a yüklemek için:"
echo -e "  bash github-sync.sh 'Yedek sonrası kod güncellemesi'"
