/* 책장 PWA 서비스워커
   전략: 네트워크 우선(항상 최신 배포를 먼저 시도), 실패 시에만 캐시 사용.
   → GitHub에 index.html을 덮어쓰면 다음 접속 때 바로 최신이 뜨고,
     오프라인일 때만 마지막으로 봤던 화면을 보여줍니다.

   v2 변경점: 페이지(HTML)를 받아올 때 브라우저 HTTP 캐시를 건너뛰고(cache:'reload')
   진짜 네트워크로 가도록 했습니다. 이제 파일만 올리면 사용자가 다음에 열 때
   항상 최신 화면을 보게 되어, 캐시 버전 숫자를 손으로 올릴 필요가 없습니다. */
const CACHE = 'bookshelf-shell-v2';

self.addEventListener('install', e => {
  self.skipWaiting();                                 // 새 워커를 기다리지 않고 즉시 설치
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));  // 옛 캐시 정리
    await self.clients.claim();                        // 열려 있는 탭도 바로 새 워커가 관리
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                    // 저장/업로드 등은 건드리지 않음
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;     // Supabase·알라딘·CDN 등 외부 요청은 그대로 통과

  // 페이지(HTML) 이동 요청은 HTTP 캐시를 건너뛰고 항상 최신을 받아온다.
  const isPage = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  e.respondWith((async () => {
    try {
      // 1) 항상 네트워크 먼저. 페이지는 cache:'reload'로 브라우저 캐시까지 우회.
      const fresh = isPage
        ? await fetch(new Request(req.url, { cache: 'reload' }))
        : await fetch(req);
      if (fresh && fresh.ok) {                          // 정상 응답만 오프라인 대비로 저장
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      // 2) 네트워크 실패(오프라인)일 때만 캐시 사용
      const cached = await caches.match(req);
      if (cached) return cached;
      if (isPage) {
        const shell = await caches.match('./index.html') || await caches.match('./');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
