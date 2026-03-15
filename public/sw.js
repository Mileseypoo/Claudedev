// Minimal service worker — enables PWA install
// Phase 1: no offline caching; just install + fetch passthrough
const CACHE_VERSION = 'v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Pass through all requests — no caching in Phase 1
  event.respondWith(fetch(event.request))
})
