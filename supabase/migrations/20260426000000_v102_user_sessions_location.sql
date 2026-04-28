-- v1.0.2: user_sessions tablosuna şehir ve ülke sütunları eklendi
-- Bağlı Cihazlar sayfasında giriş yapılan konumu göstermek için

-- 1. city ve country sütunlarını ekle (idempotent)
ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS city TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT NULL;

-- 2. Realtime zaten açık, REPLICA IDENTITY FULL zaten ayarlı (20260323 migration'ından)
-- Ancak yeni sütunların realtime'a yansıması için tekrar kontrol:
ALTER TABLE user_sessions REPLICA IDENTITY FULL;

-- 3. Performans için index (opsiyonel ama faydalı)
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
  ON user_sessions(user_id, is_active, last_seen DESC);

-- Kullanım notu:
-- İstemci tarafı (ConnectedDevices.tsx) ipapi.co/json API'si ile
-- şehir ve ülkeyi çekip bu sütunlara yazar.
-- Yeni giriş yapıldığında veya heartbeat (30sn) atıldığında güncellenir.
-- Mevcut oturumlar için konum bilgisi yoksa NULL kalır,
-- kullanıcı uygulamayı yeniden açınca otomatik dolar.
