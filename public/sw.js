const CACHE_NAME = 'aurorachat-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'AuroraChat', body: event.data.text() }; }

  const title = data.title || 'AuroraChat';
  const options = {
    body: data.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: data.data || {},
    vibrate: [200, 100, 200],
    tag: data.tag || 'aurorachat-notification',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existingClient = clientList.find((c) => c.url.includes(self.location.origin) && 'focus' in c);
      if (existingClient) {
        existingClient.focus();
        if (notifData.channel_id) {
          existingClient.postMessage({ type: 'navigate', channel_id: notifData.channel_id, message_id: notifData.message_id });
        } else if (notifData.conversation_id) {
          existingClient.postMessage({ type: 'navigate_dm', conversation_id: notifData.conversation_id, message_id: notifData.message_id });
        }
        return;
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
