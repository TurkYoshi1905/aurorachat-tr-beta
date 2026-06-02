#!/bin/bash
# AuroraChat Desktop App Builder
# Builds ZIP packages for Windows (x64 and ia32)

echo "AuroraChat Desktop uygulaması derleniyor..."
echo ""

# Check if electron-builder is available
if ! npx electron-builder --version > /dev/null 2>&1; then
  echo "electron-builder bulunamadı. 'npm install' çalıştırın."
  exit 1
fi

echo "Windows x64 (64-bit) ve ia32 (32-bit) için derleniyor..."
npx electron-builder --win --config electron-builder.json

echo ""
echo "Derleme tamamlandı! Çıktı: dist-electron/"
ls -lh dist-electron/ 2>/dev/null || echo "(dist-electron klasörü bulunamadı)"
