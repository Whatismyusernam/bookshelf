/* 책장 PWA 서비스워커
   전략: 네트워크 우선(항상 최신 배포를 먼저 시도), 실패 시에만 캐시 사용.
   → GitHub에 index.html을 덮어쓰면 다음 접속 때 바로 최신이 뜨고,
     오프라인일 때만 마지막으로 봤던 화면을 보여줍니다. */
const CACHE = 'bookshelf-shell-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // 저장/업로드 등은 건드리지 않음
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // Supabase·알라딘·CDN 등 외부 요청은 그대로 통과

  e.respondWith((async () => {
    try {
      const fresh = await fetch(req);               // 1) 항상 네트워크 먼저 (최신 배포 반영)
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());                // 성공하면 오프라인 대비로 복사만 저장
      return fresh;
    } catch (err) {
      const cached = await caches.match(req);       // 2) 오프라인일 때만 캐시 사용
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const shell = await caches.match('./index.html') || await caches.match('./');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
