// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { runInNewContext } from "node:vm"

import { Resvg } from "@resvg/resvg-js"
import { afterEach, describe, expect, it, vi } from "vitest"

import { writeServiceWorker } from "./build"

const temporaryDirectories: string[] = []

async function createSite() {
    const distPath = await mkdtemp(join(tmpdir(), "zili-pwa-test-"))
    temporaryDirectories.push(distPath)
    await mkdir(join(distPath, "static"))

    for (const [file, body] of Object.entries({
        "index.html": "<html>version one</html>",
        "manifest.webmanifest": "{}",
        "static/app.js": "app code",
        "static/export.js": "lazy export code",
        "static/app.css": "font rules",
        "static/chinese.woff2": "Chinese font",
        "static/app.js.map": "debug map",
        "account.json": "private response",
        "login.html": "login page",
    }))
        await writeFile(join(distPath, file), body)

    return distPath
}

afterEach(async () => {
    for (const path of temporaryDirectories.splice(0)) {
        if (!resolve(path).startsWith(join(resolve(tmpdir()), "zili-pwa-test-"))) throw new Error("Unexpected test directory")
        await rm(path, { recursive: true, force: true })
    }
})

interface WorkerRequest {
    method: string
    url: string
    mode?: string
}

interface WorkerEvent {
    request?: WorkerRequest
    waitUntil?: (promise: Promise<unknown>) => void
    respondWith?: (promise: Promise<Response>) => void
}

async function createWorker() {
    const distPath = await createSite()
    const manifest = await writeServiceWorker({ distPath })
    const handlers = new Map<string, (event: WorkerEvent) => void>()

    const cache = {
        addAll: vi.fn().mockResolvedValue(undefined),
        match: vi.fn<(key: string) => Promise<Response | undefined>>().mockResolvedValue(new Response("cached")),
    }

    const caches = {
        open: vi.fn().mockResolvedValue(cache),
        keys: vi.fn().mockResolvedValue([manifest.cacheName, "zili-chengtu-old", "another-application"]),
        delete: vi.fn().mockResolvedValue(true),
    }

    const fetch = vi.fn().mockResolvedValue(new Response("network"))
    const claim = vi.fn().mockResolvedValue(undefined)
    const skipWaiting = vi.fn()

    runInNewContext(await readFile(join(distPath, "sw.js"), "utf8"), {
        URL,
        Request: class extends Request {
            constructor(url: string, options: RequestInit) {
                super(new URL(url, "https://example.test"), options)
            }
        },
        caches,
        fetch,
        self: { location: { origin: "https://example.test" }, clients: { claim }, skipWaiting, addEventListener: handlers.set.bind(handlers) },
    })

    return { handlers, cache, caches, fetch, claim, skipWaiting, manifest }
}

describe("PWA release resources", () => {
    it("includes the complete shell and fonts, excludes private/debug data, and versions changed content", async () => {
        const distPath = await createSite()
        const first = await writeServiceWorker({ distPath })
        expect(first.urls).toEqual(["/index.html", "/manifest.webmanifest", "/static/app.css", "/static/app.js", "/static/chinese.woff2", "/static/export.js"])
        expect(await writeServiceWorker({ distPath })).toEqual(first)
        await writeFile(join(distPath, "index.html"), "version two")
        expect((await writeServiceWorker({ distPath })).cacheName).not.toBe(first.cacheName)
    })

    it("rejects an incomplete release", async () => {
        const distPath = await createSite()
        await rm(join(distPath, "manifest.webmanifest"))
        await expect(writeServiceWorker({ distPath })).rejects.toThrow("PWA 缺少首页或安装清单")
    })

    it("waits for all assets and does not force an update over an open document", async () => {
        const { handlers, cache, skipWaiting, manifest } = await createWorker()
        const waitUntil = vi.fn()
        handlers.get("install")!({ waitUntil })
        await waitUntil.mock.calls[0][0]
        expect(cache.addAll.mock.calls[0][0].map((request: Request) => new URL(request.url).pathname)).toEqual(manifest.urls)
        expect(cache.addAll.mock.calls[0][0].every((request: Request) => request.cache === "reload")).toBe(true)
        expect(skipWaiting).not.toHaveBeenCalled()
        cache.addAll.mockRejectedValueOnce(new Error("font unavailable"))
        handlers.get("install")!({ waitUntil })
        await expect(waitUntil.mock.calls[1][0]).rejects.toThrow("font unavailable")
    })

    it("only removes obsolete caches belonging to this app", async () => {
        const { handlers, caches, claim } = await createWorker()
        const waitUntil = vi.fn()
        handlers.get("activate")!({ waitUntil })
        await waitUntil.mock.calls[0][0]
        expect(caches.delete.mock.calls).toEqual([["zili-chengtu-old"]])
        expect(claim).toHaveBeenCalledOnce()
    })

    it("serves the cached workspace and fonts offline without mixing releases", async () => {
        const { handlers, cache, fetch } = await createWorker()
        fetch.mockRejectedValue(new Error("offline"))
        const respondWith = vi.fn()
        handlers.get("fetch")!({ request: { method: "GET", url: "https://example.test/?source=installed", mode: "navigate" }, respondWith })
        expect(await (await respondWith.mock.calls[0][0]).text()).toBe("cached")
        expect(cache.match).toHaveBeenCalledWith("/index.html")
        cache.match.mockResolvedValueOnce(new Response("font"))
        handlers.get("fetch")!({ request: { method: "GET", url: "https://example.test/static/chinese.woff2" }, respondWith })
        expect(await (await respondWith.mock.calls[1][0]).text()).toBe("font")
        expect(fetch).not.toHaveBeenCalled()
    })

    it("passes protected pages, APIs, remote images and mutations through to the network", async () => {
        const { handlers, caches } = await createWorker()
        const respondWith = vi.fn()

        for (const request of [
            { method: "GET", url: "https://example.test/login", mode: "navigate" },
            { method: "GET", url: "https://example.test/user", mode: "navigate" },
            { method: "GET", url: "https://example.test/api/account" },
            { method: "GET", url: "https://example.test/user-image.png" },
            { method: "GET", url: "https://remote.test/static/app.js" },
            { method: "POST", url: "https://example.test/" },
        ])
            handlers.get("fetch")!({ request, respondWith })

        expect(respondWith).not.toHaveBeenCalled()
        expect(caches.open).not.toHaveBeenCalled()
    })

    it.each(["missing", "open", "match"])("uses the network when cache storage is %s", async failure => {
        const { handlers, cache, caches, fetch } = await createWorker()

        if (failure === "missing") cache.match.mockResolvedValueOnce(undefined)
        else if (failure === "open") caches.open.mockRejectedValueOnce(new Error("storage denied"))
        else cache.match.mockRejectedValueOnce(new Error("cache unavailable"))

        const request = { method: "GET", url: "https://example.test/", mode: "navigate" }

        const respondWith = vi.fn()
        handlers.get("fetch")!({ request, respondWith })
        expect(await (await respondWith.mock.calls[0][0]).text()).toBe("network")
        expect(fetch).toHaveBeenCalledExactlyOnceWith(request)
    })

    it("preserves HTTP errors and does not retry a failed network request", async () => {
        const { handlers, cache, fetch } = await createWorker()
        cache.match.mockResolvedValue(undefined)

        const request = { method: "GET", url: "https://example.test/", mode: "navigate" }

        const respondWith = vi.fn()
        fetch.mockResolvedValueOnce(new Response("server error", { status: 500 }))
        handlers.get("fetch")!({ request, respondWith })
        expect((await respondWith.mock.calls[0][0]).status).toBe(500)
        fetch.mockRejectedValueOnce(new Error("offline"))
        handlers.get("fetch")!({ request, respondWith })
        await expect(respondWith.mock.calls[1][0]).rejects.toThrow("offline")
        expect(fetch).toHaveBeenCalledTimes(2)
    })
})

describe("installation icons", () => {
    const root = new URL("../../", import.meta.url)

    interface InstallationIcon {
        purpose: string
        type: string
    }

    it("uses separate desktop PNG and maskable installation artwork", async () => {
        const manifest = JSON.parse(await readFile(new URL("public/manifest.webmanifest", root), "utf8"))
        expect(manifest).toMatchObject({ id: "/", start_url: "/", scope: "/", display: "standalone", short_name: "字里成图" })
        expect(manifest.icons).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: "image/svg+xml", sizes: "any", purpose: "maskable" }),
                expect.objectContaining({ type: "image/png", sizes: "192x192" }),
                expect.objectContaining({ type: "image/png", sizes: "512x512" }),
            ]),
        )
        expect(manifest.icons.filter((icon: InstallationIcon) => icon.purpose === "any").every((icon: InstallationIcon) => icon.type === "image/png")).toBe(
            true,
        )

        for (const icon of manifest.icons) {
            const data = await readFile(new URL(`public${icon.src}`, root))

            if (icon.type === "image/png") {
                expect(data.subarray(1, 4).toString()).toBe("PNG")
                expect(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`).toBe(icon.sizes)
            } else expect(data.toString()).toContain("<svg")
        }

        const apple = await readFile(new URL("public/apple-touch-icon.png", root))
        expect([apple.readUInt32BE(16), apple.readUInt32BE(20)]).toEqual([180, 180])
    })

    it("keeps the maskable artwork inside the safe circle with a fully opaque background", async () => {
        const svg = await readFile(new URL("public/icons/maskable.svg", root), "utf8")
        const { pixels, width, height } = new Resvg(svg, { fitTo: { mode: "width", value: 512 }, font: { loadSystemFonts: false } }).render()
        let visiblePixels = 0
        let opaque = true
        let maximumRadius = 0

        for (let offset = 0; offset < pixels.length; offset += 4) {
            if (pixels[offset + 3] !== 255) opaque = false
            if (pixels[offset] === 109 && pixels[offset + 1] === 40 && pixels[offset + 2] === 217) continue
            visiblePixels++
            const x = (offset / 4) % width
            const y = Math.floor(offset / 4 / width)
            maximumRadius = Math.max(maximumRadius, Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2))
        }

        expect(opaque).toBe(true)
        expect(maximumRadius).toBeLessThanOrEqual(Math.min(width, height) * 0.4)
        expect(visiblePixels).toBeGreaterThan(20_000)
    })
})
