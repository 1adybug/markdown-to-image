// @vitest-environment node
import { lookup } from "node:dns/promises"
import { EventEmitter } from "node:events"
import type { IncomingMessage, RequestOptions } from "node:http"
import { Readable } from "node:stream"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { isPublicAddress, proxyImage } from "./proxy"

const transport = vi.hoisted(() => vi.fn())
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }))
vi.mock("node:http", () => ({ request: transport }))
vi.mock("node:https", () => ({ request: transport }))

interface UpstreamParams {
    status?: number
    type?: string
    headers?: Record<string, string>
    chunks?: Buffer[]
}

interface TestRequest extends EventEmitter {
    end: () => void
}

function upstream(params: UpstreamParams = {}) {
    const stream = Readable.from(params.chunks ?? [Buffer.from("image bytes")]) as unknown as IncomingMessage
    stream.statusCode = params.status ?? 200
    stream.headers = { "content-type": params.type ?? "image/png", ...params.headers }
    vi.spyOn(stream, "destroy")
    return stream
}

function respond(response: IncomingMessage) {
    transport.mockImplementationOnce((_url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => {
        const request = new EventEmitter() as TestRequest
        request.end = () => queueMicrotask(() => callback(response))
        options.signal?.addEventListener("abort", () => response.destroy(), { once: true })
        return request
    })
}

function imageRequest(url = "https://images.example/photo.png", signal?: AbortSignal) {
    return new Request(`https://workspace.example/api/image?${new URLSearchParams({ url })}`, { signal })
}

beforeEach(() => {
    transport.mockReset()

    vi.mocked(lookup)
        .mockReset()
        .mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never)
})

afterEach(() => vi.useRealTimers())

describe("public network boundary", () => {
    it.each(["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
        "accepts public IP %s",
        address => void expect(isPublicAddress(address)).toBe(true),
    )
    it.each([
        "127.0.0.1",
        "0.0.0.0",
        "10.1.2.3",
        "172.16.1.1",
        "192.168.1.1",
        "169.254.169.254",
        "100.64.0.1",
        "192.0.2.1",
        "198.18.0.1",
        "224.0.0.1",
        "255.255.255.255",
        "::1",
        "::",
        "fc00::1",
        "fe80::1",
        "2001:db8::1",
        "::ffff:127.0.0.1",
        "2002:7f00:1::",
        "invalid",
    ])("rejects non-public IP %s", address => void expect(isPublicAddress(address)).toBe(false))

    it.each([
        "http://127.1/a.png",
        "http://2130706433/a.png",
        "http://0x7f000001/a.png",
        "https://[::1]/a.png",
        "http://[::ffff:127.0.0.1]/a.png",
        "http://localhost/a.png",
        "https://workspace.example/api/image",
    ])("rejects target %s before connecting", async url => {
        expect((await proxyImage(imageRequest(url))).status).toBe(403)
        expect(transport).not.toHaveBeenCalled()
    })

    it("rejects mixed public/private DNS results", async () => {
        vi.mocked(lookup).mockResolvedValue([
            { address: "8.8.8.8", family: 4 },
            { address: "10.0.0.1", family: 4 },
        ] as never)

        expect((await proxyImage(imageRequest())).status).toBe(403)
        expect(transport).not.toHaveBeenCalled()
    })

    it("pins socket DNS to the approved address and does not forward caller headers", async () => {
        respond(upstream())
        const request = imageRequest()
        request.headers.set("Cookie", "session=secret")
        request.headers.set("Authorization", "Bearer secret")
        request.headers.set("Referer", "https://workspace.example/")
        const response = await proxyImage(request)
        const options = transport.mock.calls[0][1] as RequestOptions
        const callback = vi.fn()
        options.lookup!("images.example", {}, callback)
        expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4)
        expect(lookup).toHaveBeenCalledOnce()
        expect(options.agent).toBe(false)
        expect(Object.keys(options.headers!)).toEqual(["Accept", "Accept-Encoding"])
        await response.arrayBuffer()
    })
})

describe("image responses", () => {
    it("streams original image bytes without requiring upstream CORS", async () => {
        respond(upstream({ chunks: [Buffer.from("original"), Buffer.from(" bytes")] }))
        const response = await proxyImage(imageRequest())
        expect(response.status).toBe(200)
        expect(response.headers.get("Content-Type")).toBe("image/png")
        expect(response.headers.get("Cache-Control")).toBe("no-store")
        expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
        expect(await response.text()).toBe("original bytes")
    })

    it.each(["image/jpeg", "image/gif", "image/webp", "image/avif", "image/svg+xml"])("supports %s with sandbox headers", async type => {
        respond(upstream({ type }))
        const response = await proxyImage(imageRequest())
        expect(response.headers.get("Content-Type")).toBe(type)
        expect(response.headers.get("Content-Security-Policy")).toContain("sandbox")
        await response.arrayBuffer()
    })

    it.each([
        "file:///photo.png",
        "data:image/png;base64,AAAA",
        "https://user:password@images.example/a.png",
        "https://images.example:1234/a.png",
        "not a URL",
    ])("rejects malformed or unsupported URL %s", async url => {
        expect((await proxyImage(imageRequest(url))).status).toBe(400)
        expect(transport).not.toHaveBeenCalled()
    })

    it("requires exactly one url parameter", async () => {
        for (const search of ["", "?url=", "?url=a&url=b"])
            expect((await proxyImage(new Request(`https://workspace.example/api/image${search}`))).status).toBe(400)
    })

    it.each([403, 404, 500])("reports upstream status %s", async status => {
        const source = upstream({ status })
        respond(source)
        expect((await proxyImage(imageRequest())).status).toBe(502)
        expect(source.destroy).toHaveBeenCalled()
    })

    it("rejects HTML, empty responses and oversized declared bodies", async () => {
        for (const [source, status] of [
            [upstream({ type: "text/html" }), 415],
            [upstream({ chunks: [] }), 502],
            [upstream({ headers: { "content-length": String(20 * 1024 * 1024 + 1) } }), 413],
        ] as const) {
            respond(source)
            expect((await proxyImage(imageRequest())).status).toBe(status)
            expect(source.destroy).toHaveBeenCalled()
        }
    })

    it("errors an unknown-length stream exceeding the byte limit", async () => {
        respond(upstream({ chunks: [Buffer.alloc(10 * 1024 * 1024), Buffer.alloc(11 * 1024 * 1024)] }))
        await expect((await proxyImage(imageRequest())).arrayBuffer()).rejects.toThrow("20 MiB")
    })

    it("errors a truncated stream", async () => {
        respond(upstream({ headers: { "content-length": "1000" } }))
        await expect((await proxyImage(imageRequest())).arrayBuffer()).rejects.toThrow("不完整")
    })

    it("destroys upstream when the consumer cancels", async () => {
        const source = upstream()
        respond(source)
        const response = await proxyImage(imageRequest())
        await response.body!.cancel()
        expect(source.destroy).toHaveBeenCalled()
    })

    it("times out the full DNS/request operation", async () => {
        vi.useFakeTimers()
        vi.mocked(lookup).mockReturnValue(new Promise(() => {}))
        const response = proxyImage(imageRequest())
        await vi.advanceTimersByTimeAsync(15_000)
        expect((await response).status).toBe(504)
        expect(transport).not.toHaveBeenCalled()
    })

    it("applies the total timeout to an in-progress body", async () => {
        vi.useFakeTimers()
        const source = new Readable({ read() {} }) as IncomingMessage
        source.statusCode = 200
        source.headers = { "content-type": "image/png" }
        source.push(Buffer.from("partial image"))
        respond(source)
        const response = await proxyImage(imageRequest())
        const result = response.arrayBuffer().catch(error => error)
        await vi.advanceTimersByTimeAsync(15_000)
        expect(await result).toBeInstanceOf(Error)
        expect(source.destroyed).toBe(true)
    })

    it("aborts body transfer when the incoming request disconnects", async () => {
        const source = new Readable({ read() {} }) as IncomingMessage
        source.statusCode = 200
        source.headers = { "content-type": "image/png" }
        source.push(Buffer.from("partial image"))
        respond(source)
        const controller = new AbortController()
        const response = await proxyImage(imageRequest(undefined, controller.signal))
        const result = response.arrayBuffer().catch(error => error)
        controller.abort()
        expect(await result).toBeInstanceOf(Error)
        expect(source.destroyed).toBe(true)
    })

    it("cancels DNS work when the incoming request is aborted", async () => {
        vi.mocked(lookup).mockReturnValue(new Promise(() => {}))
        const controller = new AbortController()
        const response = proxyImage(imageRequest(undefined, controller.signal))
        controller.abort()
        expect((await response).status).toBe(499)
        expect(transport).not.toHaveBeenCalled()
    })

    it("revalidates redirects including internal addresses", async () => {
        respond(upstream({ status: 302, headers: { location: "/next.png" } }))
        respond(upstream())
        const response = await proxyImage(imageRequest())
        expect(transport.mock.calls[1][0].pathname).toBe("/next.png")
        expect(lookup).toHaveBeenCalledTimes(2)
        await response.arrayBuffer()
        respond(upstream({ status: 302, headers: { location: "http://169.254.169.254/secret" } }))
        expect((await proxyImage(imageRequest())).status).toBe(403)
        expect(transport).toHaveBeenCalledTimes(3)
    })

    it("stops after three redirects", async () => {
        for (let index = 0; index < 4; index++) respond(upstream({ status: 302, headers: { location: `/next-${index}.png` } }))
        expect((await proxyImage(imageRequest())).status).toBe(502)
        expect(transport).toHaveBeenCalledTimes(4)
    })
})
