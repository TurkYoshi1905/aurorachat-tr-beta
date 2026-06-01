// Tauri masaüstü bildirim yardımcıları.
// Tauri ortamında window.__TAURI__.notification (withGlobalTauri:true) üzerinden
// çalışır; web tarayıcısında graceful Notification API fallback kullanır.
// Bu modül `@tauri-apps/api` paketini bundle etmez; bağımlılık eklemeden çalışır.

interface TauriNotificationApi {
  isPermissionGranted: () => Promise<boolean>;
  requestPermission: () => Promise<'granted' | 'denied' | 'default'>;
  sendNotification: (opts: { title: string; body?: string; icon?: string }) => void;
}

interface TauriRuntime {
  notification?: TauriNotificationApi;
}

const STORAGE_KEY = 'aurorachat_notif_permission_v1';

const getTauri = (): TauriRuntime | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __TAURI__?: TauriRuntime };
  return w.__TAURI__ ?? null;
};

const getTauriNotification = (): TauriNotificationApi | null => {
  const t = getTauri();
  return t?.notification ?? null;
};

/**
 * Uygulama açılışında bir kez çağırın.
 * Daha önce kullanıcıya sorulmadıysa Tauri/Web bildirim iznini ister
 * ve sonucu localStorage'a kaydeder.
 */
export const initNotificationPermission = async (): Promise<void> => {
  if (localStorage.getItem(STORAGE_KEY)) return;

  const tauriNotif = getTauriNotification();
  if (tauriNotif) {
    try {
      const already = await tauriNotif.isPermissionGranted();
      if (already) {
        localStorage.setItem(STORAGE_KEY, 'granted');
        return;
      }
      const result = await tauriNotif.requestPermission();
      localStorage.setItem(STORAGE_KEY, result);
    } catch {
      // sessizce yoksay
    }
    return;
  }

  // Web tarayıcı fallback
  if (typeof Notification !== 'undefined') {
    try {
      if (Notification.permission === 'granted') {
        localStorage.setItem(STORAGE_KEY, 'granted');
        return;
      }
      if (Notification.permission === 'default') {
        const result = await Notification.requestPermission();
        localStorage.setItem(STORAGE_KEY, result);
      } else {
        localStorage.setItem(STORAGE_KEY, Notification.permission);
      }
    } catch {
      // sessizce yoksay
    }
  }
};

interface NotifyOpts {
  title: string;
  body?: string;
  icon?: string;
}

/** Tauri varsa Tauri ile, yoksa Web Notification API ile bildirim atar. */
export const sendDesktopNotification = async (opts: NotifyOpts): Promise<void> => {
  const tauriNotif = getTauriNotification();
  if (tauriNotif) {
    try {
      const granted = await tauriNotif.isPermissionGranted();
      if (!granted) return;
      tauriNotif.sendNotification({ title: opts.title, body: opts.body, icon: opts.icon });
    } catch {
      // yoksay
    }
    return;
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      // eslint-disable-next-line no-new
      new Notification(opts.title, { body: opts.body, icon: opts.icon });
    } catch {
      // yoksay
    }
  }
};
