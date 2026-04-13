import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from '@/i18n';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const DISMISSED_KEY = 'notification_permission_dismissed';
const LAST_SUB_KEY = 'push_subscription_saved_at';
const REFRESH_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 gün
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Eski Google FCM endpoint formatı (2024'te kapatıldı)
const isLegacyEndpoint = (endpoint: string) =>
  endpoint.includes('fcm.googleapis.com/fcm/send/');

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function removeOldSubscriptions(userId: string) {
  const { data: subs } = await (supabase.from('push_subscriptions') as any)
    .select('endpoint')
    .eq('user_id', userId);
  if (!subs) return;
  const legacyEndpoints = subs
    .map((s: any) => s.endpoint)
    .filter((ep: string) => isLegacyEndpoint(ep));
  if (legacyEndpoints.length > 0) {
    await (supabase.from('push_subscriptions') as any)
      .delete()
      .in('endpoint', legacyEndpoints);
  }
}

async function savePushSubscription(userId: string, subscription: PushSubscription) {
  const subJson = subscription.toJSON();
  if (!subJson.endpoint || !subJson.keys?.auth || !subJson.keys?.p256dh) return;
  await (supabase.from('push_subscriptions') as any).upsert({
    user_id: userId,
    endpoint: subJson.endpoint,
    auth: subJson.keys.auth,
    p256dh: subJson.keys.p256dh,
  }, { onConflict: 'user_id,endpoint' });
  localStorage.setItem(LAST_SUB_KEY, String(Date.now()));
}

async function subscribeToPush(userId: string, forceRefresh = false) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (!VAPID_PUBLIC_KEY) return;
  try {
    // Eski geçersiz abonelikleri temizle
    await removeOldSubscriptions(userId);

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    // Eski endpoint formatıysa veya zorla yenileme isteniyorsa sıfırla
    const needsRefresh =
      forceRefresh ||
      (subscription && isLegacyEndpoint(subscription.endpoint));

    if (needsRefresh && subscription) {
      await subscription.unsubscribe();
      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    await savePushSubscription(userId, subscription);
  } catch {
    // Push aboneliği bu ortamda kullanılamıyor
  }
}

function shouldRefreshSubscription(): boolean {
  const lastSaved = localStorage.getItem(LAST_SUB_KEY);
  if (!lastSaved) return true;
  return Date.now() - Number(lastSaved) > REFRESH_INTERVAL_MS;
}

export default function NotificationPermissionBanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (
      'Notification' in window &&
      Notification.permission === 'default' &&
      localStorage.getItem(DISMISSED_KEY) !== 'true'
    ) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!user || !('Notification' in window) || !VAPID_PUBLIC_KEY) return;

    if (Notification.permission === 'granted') {
      // Her zaman mevcut aboneliği kaydet; 3 günde bir zorla yenile
      subscribeToPush(user.id, shouldRefreshSubscription());
    } else if (Notification.permission === 'default') {
      // İzin henüz verilmemiş — banneri tekrar göster
      if (localStorage.getItem(DISMISSED_KEY) !== 'true') {
        setVisible(true);
      }
    }
  }, [user]);

  if (!visible) return null;

  const handleAllow = async () => {
    const result = await Notification.requestPermission();
    setVisible(false);
    if (result === 'granted') {
      toast({ title: t('notifications.enabled'), description: t('notifications.enabledDesc') });
      if (user && VAPID_PUBLIC_KEY) {
        await subscribeToPush(user.id, true);
      }
    } else {
      localStorage.setItem(DISMISSED_KEY, 'true');
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-lg">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{t('notifications.enableTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('notifications.enableDesc')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={handleAllow}>{t('notifications.allowBtn')}</Button>
          <button onClick={handleDismiss} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
