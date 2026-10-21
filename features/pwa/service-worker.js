/* global __PRECACHE__ */

const { cacheName, urls } = __PRECACHE__
const precacheUrls = new Set(urls.map(url => new URL(url, self.location.origin).href))

async function readCachedResponse(key) {
    try {
        const cache = await caches.open(cacheName)
        return await cache.match(key)
    } catch {
        // Cache Storage can be denied or evicted independently of connectivity.
        return undefined
    }
}

self.addEventListener("install", event => {
    // A new version is installable only after its complete shell and fonts are cached.
    // Do not skipWaiting: an update must not interrupt an open document or export.
    event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(urls.map(url => new Request(url, { cache: "reload" })))))
})

self.addEventListener(
    "activate",
    event =>
        void event.waitUntil(
            caches
                .keys()
                .then(names => Promise.all(names.filter(name => name.startsWith("zili-chengtu-") && name !== cacheName).map(name => caches.delete(name))))
                .then(() => self.clients.claim()),
        ),
)

self.addEventListener("fetch", event => {
    const { request } = event
    if (request.method !== "GET") return
    const url = new URL(request.url)
    if (url.origin !== self.location.origin) return

    // Only the public workspace has an offline document. Never cache account/API
    // responses, protected navigations, or images referenced by a user's Markdown.
    const isWorkspace = request.mode === "navigate" && (url.pathname === "/" || url.pathname === "/index.html")
    const cacheKey = isWorkspace ? "/index.html" : request.url
    if (!isWorkspace && (request.mode === "navigate" || !precacheUrls.has(request.url))) return

    // Keep HTML and hashed assets on the same release until the waiting worker activates.
    event.respondWith(readCachedResponse(cacheKey).then(response => response ?? fetch(request)))
})
