#!/bin/bash
# ============================================================
# AuroraChat — Supabase Yedekten Geri Yükleme (Yerel Script)
# Kullanım: bash scripts/restore-from-github.sh
#           bash scripts/restore-from-github.sh <dosya_adi.dump>
# ============================================================

set -e

REPO="TurkYoshi1905/aurorachat-tr-beta"
BRANCH="database-backups"
DB_HOST="db.ktittqaubkaylprxnoya.supabase.co"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="postgres"
TEMP_DIR="/tmp/aurora_restore_$$"

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║   AuroraChat Supabase Geri Yükleme    ║${NC}"
echo -e "${CYAN}${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""

# GITHUB_PAT kontrolü
if [ -z "$GITHUB_PAT" ]; then
  echo -e "${RED}❌ HATA: GITHUB_PAT ortam değişkeni bulunamadı.${NC}"
  echo "   export GITHUB_PAT=ghp_..." 
  exit 1
fi

# Veritabanı şifresini al
if [ -z "$PGPASSWORD" ]; then
  echo -e "${YELLOW}🔐 Supabase veritabanı şifresi:${NC}"
  read -s PGPASSWORD
  export PGPASSWORD
fi

# pg_restore kontrolü
if ! command -v pg_restore &> /dev/null; then
  echo -e "${RED}❌ HATA: pg_restore bulunamadı. postgresql-client kurun.${NC}"
  echo "   sudo apt-get install postgresql-client"
  exit 1
fi

# GitHub'dan yedek listesini çek
echo -e "${CYAN}📡 GitHub'dan yedek listesi alınıyor...${NC}"
BACKUP_LIST=$(curl -sf \
  -H "Authorization: token $GITHUB_PAT" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/${REPO}/contents/backups?ref=${BRANCH}" \
  | grep '"name"' | grep '\.dump' | sed 's/.*"name": "\(.*\)".*/\1/' | sort -r)

if [ -z "$BACKUP_LIST" ]; then
  echo -e "${RED}❌ Hiç yedek bulunamadı veya branch mevcut değil.${NC}"
  exit 1
fi

# Dosya belirtilmişse direkt kullan, yoksa listele
if [ -n "$1" ]; then
  SELECTED="$1"
  echo -e "${GREEN}✅ Seçilen yedek: ${SELECTED}${NC}"
else
  echo ""
  echo -e "${BOLD}📋 Mevcut Yedekler:${NC}"
  echo ""
  i=1
  declare -a BACKUP_ARRAY
  while IFS= read -r line; do
    BACKUP_ARRAY+=("$line")
    DATE_PART=$(echo "$line" | grep -oP '\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}' | head -1 | sed 's/_/ /')
    LABEL_PART=$(echo "$line" | sed 's/backup_[0-9_-]*_//' | sed 's/\.dump//')
    echo "  ${i}) ${line}"
    ((i++))
  done <<< "$BACKUP_LIST"

  echo ""
  echo -e "${YELLOW}Geri yüklenecek yedek numarasını girin:${NC}"
  read -r CHOICE
  
  if ! [[ "$CHOICE" =~ ^[0-9]+$ ]] || [ "$CHOICE" -lt 1 ] || [ "$CHOICE" -gt "${#BACKUP_ARRAY[@]}" ]; then
    echo -e "${RED}❌ Geçersiz seçim.${NC}"
    exit 1
  fi
  
  SELECTED="${BACKUP_ARRAY[$((CHOICE-1))]}"
fi

echo ""
echo -e "${RED}${BOLD}⚠️  UYARI: Bu işlem mevcut veritabanını geri yüklenecek veriyle değiştirecek!${NC}"
echo -e "${YELLOW}   Dosya: ${SELECTED}${NC}"
echo ""
echo -e "${BOLD}Devam etmek için 'EVET' yazın:${NC}"
read -r CONFIRM

if [ "$CONFIRM" != "EVET" ]; then
  echo -e "${YELLOW}⛔ İptal edildi.${NC}"
  exit 0
fi

# Geçici klasör oluştur
mkdir -p "$TEMP_DIR"
DUMP_FILE="${TEMP_DIR}/${SELECTED}"

# Dosyayı indir
echo ""
echo -e "${CYAN}⬇️  Yedek indiriliyor: ${SELECTED}${NC}"

DOWNLOAD_URL=$(curl -sf \
  -H "Authorization: token $GITHUB_PAT" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/${REPO}/contents/backups/${SELECTED}?ref=${BRANCH}" \
  | grep '"download_url"' | sed 's/.*"download_url": "\(.*\)".*/\1/')

if [ -z "$DOWNLOAD_URL" ]; then
  echo -e "${RED}❌ İndirme URL'si alınamadı.${NC}"
  rm -rf "$TEMP_DIR"
  exit 1
fi

curl -Lf \
  -H "Authorization: token $GITHUB_PAT" \
  -o "$DUMP_FILE" \
  "$DOWNLOAD_URL"

SIZE=$(du -sh "$DUMP_FILE" | cut -f1)
echo -e "${GREEN}✅ İndirildi: ${SIZE}${NC}"

# Geri yükle
echo ""
echo -e "${CYAN}♻️  Geri yükleniyor...${NC}"

pg_restore \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  --no-privileges \
  --clean \
  --if-exists \
  "$DUMP_FILE" \
  2>&1 | grep -v "^pg_restore: warning" || true

echo ""
echo -e "${GREEN}${BOLD}✅ Geri yükleme tamamlandı!${NC}"
echo -e "   📁 Yedek: ${SELECTED}"
echo -e "   📅 Tarih: $(date '+%d.%m.%Y %H:%M')"

# Temizle
rm -rf "$TEMP_DIR"
