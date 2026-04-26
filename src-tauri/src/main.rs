// Windows'ta release modda konsol penceresi açılmasın
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      let handle = app.handle();
      // Uygulama açılınca arka planda güncelleme kontrolü yap
      tauri::async_runtime::spawn(async move {
        match tauri::updater::builder(handle.clone()).check().await {
          Ok(update) => {
            if update.is_update_available() {
              // Dialog built-in olarak açılır (tauri.conf.json'da dialog: true)
              if let Err(e) = update.download_and_install().await {
                eprintln!("Güncelleme kurulamadı: {}", e);
              }
            }
          }
          Err(e) => {
            eprintln!("Güncelleme kontrolü başarısız: {}", e);
          }
        }
      });
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("AuroraChat başlatılamadı");
}
