// Loaded into the generated service worker (workbox importScripts): shows DHA reminders.
self.addEventListener('push', (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch (e) {
    d = {body: event.data ? event.data.text() : ''};
  }
  event.waitUntil(
    self.registration.showNotification(d.title || 'DHA', {
      body: d.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: d.tag || 'dha',
      data: {url: d.url || '/'},
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({type: 'window', includeUncontrolled: true}).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
