const CACHE_NAME = 'aurorachat-v5';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  const handlePush = async () => {
    if (!event.data) return;

    let data = {};
    try {
      data = event.data.json();
    } catch {
      data = { title: 'AuroraChat', body: event.data.text() };
    }

    const title = data.title || 'AuroraChat';
    const options = {
      body: data.body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: data.data || {},
      vibrate: [200, 100, 200, 100, 200],
      tag: data.tag || 'aurorachat-notification',
      renotify: true,
      requireInteraction: true,
      silent: false,
      actions: [
        { action: 'open', title: 'Aç' },
        { action: 'dismiss', title: 'Kapat' },
      ],
    };

    await self.registration.showNotification(title, options);
  };

  event.waitUntil(handlePush());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const notifData = event.notification.data || {};

  const handleClick = async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existingClient = allClients.find(
      (c) => c.url.includes(self.location.origin) && 'focus' in c
    );

    if (existingClient) {
      await existingClient.focus();
      if (notifData.channel_id) {
        existingClient.postMessage({
          type: 'navigate',
          channel_id: notifData.channel_id,
          message_id: notifData.message_id,
        });
      } else if (notifData.conversation_id) {
        existingClient.postMessage({
          type: 'navigate_dm',
          conversation_id: notifData.conversation_id,
          message_id: notifData.message_id,
        });
      }
      return;
    }

    if (clients.openWindow) {
      let targetUrl = '/';
      if (notifData.conversation_id) {
        targetUrl = `/?dm=${notifData.conversation_id}`;
      } else if (notifData.channel_id) {
        targetUrl = `/?channel=${notifData.channel_id}`;
      }
      await clients.openWindow(targetUrl);
    }
  };

  event.waitUntil(handleClick());
});

self.addEventListener('notificationclose', (event) => {
  // Bildirim kapatıldığında ekstra işlem gerekmez
});

// Foreground notification helper (screen share)
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SHOW_FOREGROUND_NOTIFICATION') {
    self.registration.showNotification(event.data.title || 'AuroraChat', {
      body: event.data.body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: event.data.tag || 'foreground',
      requireInteraction: true,
      silent: false,
      vibrate: [100],
    });
  } else if (event.data.type === 'CLOSE_NOTIFICATION') {
    self.registration.getNotifications({ tag: event.data.tag || 'foreground' }).then((notifs) => {
      notifs.forEach((n) => n.close());
    });
  } else if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
