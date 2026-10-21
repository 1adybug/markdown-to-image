// @vitest-environment node
import { execFile } from "node:child_process"
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import process from "node:process"
import { promisify } from "node:util"
import { runInNewContext } from "node:vm"

import { Resvg } from "@resvg/resvg-js"
import type { NextAdapter } from "next"
import { AdapterOutputType } from "next/constants"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createPwaAdapter } from "./adapter.mjs"
import { writeServiceWorker } from "./build.mjs"

const temporaryDirectories: string[] = []

async function createSite(layout = "local") {
    const distPath = await mkdtemp(join(tmpdir(), "zili-pwa-test-"))
    temporaryDirectories.push(distPath)
    const htmlFile = layout === "local" ? ".next/server/app/index.html" : "build-output/server/route-cache/APP_PAGE/home/$/index.html"
    const staticDirectory = layout === "local" ? ".next/static" : "build-output/static"

    const files = {
        [htmlFile]: "<html>version one</html>",
        [htmlFile.replace(".html", ".rsc")]: "RSC response",
        "public/manifest.webmanifest": "{}",
        [`${staticDirectory}/app.js`]: "app code",
        [`${staticDirectory}/export.js`]: "lazy export code",
        [`${staticDirectory}/app.css`]: "font rules",
        [`${staticDirectory}/chinese.woff2`]: "Chinese font",
        [`${staticDirectory}/app.js.map`]: "debug map",
        "account.json": "private response",
        "login.html": "login page",
    }

    for (const [file, body] of Object.entries(files)) {
        await mkdir(dirname(join(distPath, file)), { recursive: true })
        await writeFile(join(distPath, file), body)
    }

    const outputs = {
        prerenders: [
            {
                id: "/",
                pathname: "/",
                type: AdapterOutputType.PRERENDER,
                parentOutputId: "/page",
                groupId: 0,
                route: "/",
                routeType: "page",
                response: "complete",
                compute: "static",
                config: {},
                fallback: { filePath: join(distPath, htmlFile), postponedState: undefined, initialRevalidate: false },
            },
        ],
        staticFiles: Object.keys(files)
            .filter(file => file.startsWith(`${staticDirectory}/`) || file === "account.json" || file === "login.html")
            .map(file => ({
                id: file,
                type: AdapterOutputType.STATIC_FILE as const,
                pathname: file.startsWith(`${staticDirectory}/`) ? file.replace(staticDirectory, "/_next/static") : `/${file}`,
                filePath: join(distPath, file),
                immutableHash: undefined,
            })),
    } satisfies Parameters<typeof writeServiceWorker>[0]["outputs"]

    return { projectPath: distPath, outputs, htmlPath: join(distPath, htmlFile) }
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
    headers?: Headers
}

interface WorkerEvent {
    request?: WorkerRequest
    waitUntil?: (promise: Promise<unknown>) => void
    respondWith?: (promise: Promise<Response>) => void
}

async function createWorker() {
    const site = await createSite()
    const manifest = await writeServiceWorker(site)
    const handlers = new Map<string, (event: WorkerEvent) => void>()

    const cache = {
        addAll: vi.fn().mockResolvedValue(undefined),
        match: vi.fn<(key: string) => Promise<Response | undefined>>().mockResolvedValue(new Response("cached")),
        put: vi.fn<(key: string, response: Response) => Promise<void>>().mockResolvedValue(undefined),
    }

    const caches = {
        open: vi.fn().mockResolvedValue(cache),
        keys: vi.fn().mockResolvedValue([manifest.cacheName, "zili-chengtu-old", "another-application"]),
        delete: vi.fn().mockResolvedValue(true),
    }

    const fetch = vi.fn().mockResolvedValue(new Response("network"))
    const claim = vi.fn().mockResolvedValue(undefined)
    const skipWaiting = vi.fn()

    runInNewContext(await readFile(join(site.projectPath, "public/sw.js"), "utf8"), {
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
    it.each(["local", "adapter"])("uses %s build metadata, includes the complete shell and fonts, and versions changed content", async layout => {
        const site = await createSite(layout)
        const first = await writeServiceWorker(site)
        expect(first.urls).toEqual([
            "/",
            "/_next/static/app.css",
            "/_next/static/app.js",
            "/_next/static/chinese.woff2",
            "/_next/static/export.js",
            "/manifest.webmanifest",
        ])
        expect(await writeServiceWorker(site)).toEqual(first)
        await writeFile(site.htmlPath, "version two")
        const changedHtml = await writeServiceWorker(site)
        expect(changedHtml.cacheName).not.toBe(first.cacheName)
        await writeFile(site.outputs.staticFiles[0].filePath, "new app code")
        expect((await writeServiceWorker(site)).cacheName).not.toBe(changedHtml.cacheName)
    })

    it("rejects an incomplete release", async () => {
        const site = await createSite()
        await rm(join(site.projectPath, "public/manifest.webmanifest"))
        await expect(writeServiceWorker(site)).rejects.toThrow("PWA 缺少完整的静态首页或安装清单")
    })

    it("rejects a missing or dynamic homepage instead of generating a partial offline release", async () => {
        const site = await createSite("adapter")
        const homepage = site.outputs.prerenders[0]
        for (const prerenders of [[], [{ ...homepage, compute: "blocking" as const }], [{ ...homepage, response: "initial" as const }]])
            await expect(writeServiceWorker({ ...site, outputs: { ...site.outputs, prerenders } })).rejects.toThrow("PWA 缺少完整的静态首页")
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
        expect(cache.match).toHaveBeenCalledWith("/")
        cache.match.mockResolvedValueOnce(new Response("font"))
        handlers.get("fetch")!({ request: { method: "GET", url: "https://example.test/_next/static/chinese.woff2" }, respondWith })
        expect(await (await respondWith.mock.calls[1][0]).text()).toBe("font")
        expect(fetch).not.toHaveBeenCalled()
    })

    it("uses the current installation name online while an older shell remains active", async () => {
        const { handlers, cache, fetch } = await createWorker()
        cache.match.mockResolvedValue(new Response(JSON.stringify({ name: "字里成图 · Markdown 转图片" })))

        const currentManifest = { name: "字里成图", short_name: "字里成图" }

        fetch.mockResolvedValueOnce(new Response(JSON.stringify(currentManifest)))

        const request = { method: "GET", url: "https://example.test/manifest.webmanifest" }

        const respondWith = vi.fn()

        handlers.get("fetch")!({ request, respondWith })
        expect(await (await respondWith.mock.calls[0][0]).json()).toEqual(currentManifest)
        expect(fetch).toHaveBeenCalledExactlyOnceWith(request, { cache: "no-cache" })
        expect(cache.match).not.toHaveBeenCalled()
        expect(cache.put).toHaveBeenCalledOnce()
        const [key, response] = cache.put.mock.calls[0]
        expect(key).toBe("/manifest.webmanifest")
        expect(await response.json()).toEqual(currentManifest)
    })

    it("falls back to the cached installation manifest only when the network fails", async () => {
        const { handlers, cache, fetch } = await createWorker()

        const savedManifest = { name: "字里成图", short_name: "字里成图" }

        cache.match.mockResolvedValueOnce(new Response(JSON.stringify(savedManifest)))
        fetch.mockRejectedValueOnce(new Error("offline"))
        const respondWith = vi.fn()

        handlers.get("fetch")!({ request: { method: "GET", url: "https://example.test/manifest.webmanifest" }, respondWith })
        expect(await (await respondWith.mock.calls[0][0]).json()).toEqual(savedManifest)
        expect(fetch).toHaveBeenCalledOnce()
        expect(cache.match).toHaveBeenCalledWith("/manifest.webmanifest")
        expect(cache.put).not.toHaveBeenCalled()
    })

    it.each(["open", "put"])("keeps the current installation manifest available when cache %s fails", async failure => {
        const { handlers, cache, caches, fetch } = await createWorker()

        if (failure === "open") caches.open.mockRejectedValueOnce(new Error("storage denied"))
        else cache.put.mockRejectedValueOnce(new Error("quota exceeded"))

        const currentManifest = { name: "字里成图" }

        fetch.mockResolvedValueOnce(new Response(JSON.stringify(currentManifest)))
        const respondWith = vi.fn()

        handlers.get("fetch")!({ request: { method: "GET", url: "https://example.test/manifest.webmanifest" }, respondWith })
        expect(await (await respondWith.mock.calls[0][0]).json()).toEqual(currentManifest)
        expect(cache.match).not.toHaveBeenCalled()
    })

    it("preserves manifest HTTP errors and rejects offline requests without a cached manifest", async () => {
        const { handlers, cache, fetch } = await createWorker()

        const request = { method: "GET", url: "https://example.test/manifest.webmanifest" }

        const respondWith = vi.fn()

        fetch.mockResolvedValueOnce(new Response("server error", { status: 500 }))
        handlers.get("fetch")!({ request, respondWith })
        expect((await respondWith.mock.calls[0][0]).status).toBe(500)
        expect(cache.put).not.toHaveBeenCalled()
        expect(cache.match).not.toHaveBeenCalled()

        fetch.mockRejectedValueOnce(new Error("offline"))
        cache.match.mockResolvedValueOnce(undefined)
        handlers.get("fetch")!({ request, respondWith })
        await expect(respondWith.mock.calls[1][0]).rejects.toThrow("offline")
        expect(fetch).toHaveBeenCalledTimes(2)
    })

    it("passes protected pages, APIs, remote images and mutations through to the network", async () => {
        const { handlers, caches } = await createWorker()
        const respondWith = vi.fn()

        for (const request of [
            { method: "GET", url: "https://example.test/login", mode: "navigate" },
            { method: "GET", url: "https://example.test/user", mode: "navigate" },
            { method: "GET", url: "https://example.test/api/account" },
            { method: "GET", url: "https://example.test/api/image?url=https%3A%2F%2Fremote.test%2Fphoto.png" },
            { method: "GET", url: "https://example.test/?_rsc=payload", mode: "navigate" },
            { method: "GET", url: "https://example.test/", mode: "navigate", headers: new Headers({ RSC: "1" }) },
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

describe("PWA deployment adapter", () => {
    type BuildContext = Parameters<NonNullable<NextAdapter["onBuildComplete"]>>[0]

    it.each(["mjs", "cjs"])("loads the platform-supplied %s adapter through NEXT_ADAPTER_PATH", async extension => {
        const site = await createSite()
        const platformPath = join(site.projectPath, `platform.${extension}`)
        const declaration = extension === "mjs" ? "export default" : "module.exports ="
        await writeFile(platformPath, `${declaration} { name: "Test platform", modifyConfig(config) { return { ...config, platformLoaded: true } } }`)
        const adapterUrl = new URL("./adapter.mjs", import.meta.url).href
        const { stdout } = await promisify(execFile)(
            process.execPath,
            [
                "--input-type=module",
                "-e",
                `import adapter from ${JSON.stringify(adapterUrl)}; console.log(JSON.stringify({ name: adapter.name, config: await adapter.modifyConfig({}) }))`,
            ],
            { env: { ...process.env, NEXT_ADAPTER_PATH: platformPath } },
        )
        expect(JSON.parse(stdout)).toEqual({ name: "PWA + Test platform", config: { platformLoaded: true } })
    })

    it("generates the worker before the platform packages public files and preserves its config hook", async () => {
        const site = await createSite("adapter")
        const deployedWorker = join(site.projectPath, "deployed-sw.js")

        const platformAdapter: NextAdapter = {
            name: "Vercel",
            modifyConfig: vi.fn(config => config),
            onBuildComplete: vi.fn(async params => void (await copyFile(join(params.projectDir, "public/sw.js"), deployedWorker))),
        }

        const adapter = createPwaAdapter({ platformAdapter })
        const params = { projectDir: site.projectPath, outputs: site.outputs } as BuildContext

        await expect(readFile(deployedWorker)).rejects.toMatchObject({ code: "ENOENT" })
        await adapter.onBuildComplete!(params)

        const source = await readFile(deployedWorker, "utf8")
        expect(source).not.toContain("const { cacheName, urls } = __PRECACHE__")
        expect(source).toContain("/_next/static/chinese.woff2")
        expect(source).toBe(await readFile(join(site.projectPath, "public/sw.js"), "utf8"))
        expect(adapter.modifyConfig).toBe(platformAdapter.modifyConfig)
        expect(platformAdapter.onBuildComplete).toHaveBeenCalledExactlyOnceWith(params)
    })

    it("generates local releases without a platform adapter", async () => {
        const site = await createSite("adapter")
        await createPwaAdapter().onBuildComplete!({ projectDir: site.projectPath, outputs: site.outputs } as BuildContext)
        expect(await readFile(join(site.projectPath, "public/sw.js"), "utf8")).toContain("zili-chengtu-")
    })

    it("does not package an incomplete release and propagates platform failures", async () => {
        const site = await createSite("adapter")

        const platformAdapter: NextAdapter = { name: "Vercel", onBuildComplete: vi.fn().mockRejectedValue(new Error("packaging failed")) }

        const adapter = createPwaAdapter({ platformAdapter })
        const params = { projectDir: site.projectPath, outputs: site.outputs } as BuildContext

        await expect(adapter.onBuildComplete!(params)).rejects.toThrow("packaging failed")
        await rm(site.htmlPath)
        vi.mocked(platformAdapter.onBuildComplete!).mockClear()
        await expect(adapter.onBuildComplete!(params)).rejects.toMatchObject({ code: "ENOENT" })
        expect(platformAdapter.onBuildComplete).not.toHaveBeenCalled()
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
