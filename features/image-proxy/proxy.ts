import { lookup } from "node:dns/promises"
import { type IncomingMessage, request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import { isIP } from "node:net"

import ipaddr from "ipaddr.js"

const maximumBytes = 20 * 1024 * 1024
const timeoutMs = 15_000
const redirectStatuses = new Set([301, 302, 303, 307, 308])
const imageTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/svg+xml"])

const responseHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }

class ImageProxyError extends Error {
    constructor(
        public status: number,
        message: string,
    ) {
        super(message)
    }
}

export function isPublicAddress(address: string) {
    try {
        const parsed = ipaddr.process(address)
        return parsed.range() === "unicast" && (parsed.kind() === "ipv4" || parsed.match(ipaddr.parse("2000::"), 3))
    } catch {
        return false
    }
}

function parseTarget(value: string, origin: URL) {
    let url: URL

    try {
        url = new URL(value)
    } catch {
        throw new ImageProxyError(400, "图片地址无效，请使用完整的 HTTP 或 HTTPS 地址。")
    }

    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port)
        throw new ImageProxyError(400, "仅支持不含账号信息和非标准端口的 HTTP 或 HTTPS 图片地址。")

    const hostname = url.hostname
        .replace(/^\[|\]$/g, "")
        .replace(/\.$/, "")
        .toLowerCase()

    if (
        hostname ===
            origin.hostname
                .replace(/^\[|\]$/g, "")
                .replace(/\.$/, "")
                .toLowerCase() ||
        hostname === "localhost" ||
        hostname.endsWith(".localhost")
    )
        throw new ImageProxyError(403, "不允许代理本站、本机或内部网络地址。")

    url.hash = ""
    return { url, hostname }
}

async function abortable<T>(promise: Promise<T>, signal: AbortSignal) {
    signal.throwIfAborted()
    let onAbort: () => void

    try {
        return await Promise.race([
            promise,
            new Promise<never>((_, reject) => {
                onAbort = () => reject(signal.reason)
                signal.addEventListener("abort", onAbort, { once: true })
            }),
        ])
    } finally {
        signal.removeEventListener("abort", onAbort!)
    }
}

interface OpenImageParams {
    value: string
    origin: URL
    signal: AbortSignal
}

async function openImage({ value, origin, signal }: OpenImageParams): Promise<IncomingMessage> {
    let target = value

    for (let redirects = 0; redirects <= 3; redirects++) {
        const { url, hostname } = parseTarget(target, origin)
        const family = isIP(hostname)
        const addresses = family ? [{ address: hostname, family }] : await abortable(lookup(hostname, { all: true, verbatim: true }), signal)
        if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address)))
            throw new ImageProxyError(403, "不允许代理本机、内网或保留网络地址。")

        const address = addresses.find(candidate => candidate.family === 4) ?? addresses[0]
        const response = await new Promise<IncomingMessage>((resolve, reject) => {
            // Keep the hostname for Host/TLS, but pin the socket lookup to the vetted IP.
            // A separate DNS lookup at connection time would reopen DNS rebinding attacks.
            const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
                url,
                {
                    method: "GET",
                    agent: false,
                    family: address.family,
                    lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
                    signal,
                    headers: { Accept: [...imageTypes].join(", "), "Accept-Encoding": "identity" },
                },
                resolve,
            )

            request.once("error", reject)
            request.end()
        })

        if (!redirectStatuses.has(response.statusCode ?? 0)) return response
        const location = response.headers.location
        response.destroy()
        if (!location || redirects === 3) throw new ImageProxyError(502, "图片地址重定向无效或次数过多。")
        target = new URL(location, url).href
    }

    throw new ImageProxyError(502, "图片地址重定向次数过多。")
}

export async function proxyImage(request: Request): Promise<Response> {
    const input = new URL(request.url)
    const values = input.searchParams.getAll("url")
    if (values.length !== 1 || !values[0]) return Response.json({ message: "请提供一个完整的图片地址。" }, { status: 400, headers: responseHeaders })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new ImageProxyError(504, "图片获取超时，请检查网络后重试。")), timeoutMs)
    const cancel = () => controller.abort(request.signal.reason)
    request.signal.addEventListener("abort", cancel, { once: true })
    if (request.signal.aborted) cancel()

    const cleanup = () => {
        clearTimeout(timer)
        request.signal.removeEventListener("abort", cancel)
    }

    let upstream: IncomingMessage | undefined

    try {
        upstream = await openImage({ value: values[0], origin: input, signal: controller.signal })
        if (upstream.statusCode !== 200) throw new ImageProxyError(502, "原站未能提供图片，地址可能已失效或存在访问限制。")
        const type = upstream.headers["content-type"]?.split(";")[0].trim().toLowerCase()
        if (!type || !imageTypes.has(type)) throw new ImageProxyError(415, "该地址未返回支持的图片格式。")
        if (upstream.headers["content-encoding"] && upstream.headers["content-encoding"] !== "identity")
            throw new ImageProxyError(415, "原站返回了不支持的图片传输编码。")
        const declaredSize = Number(upstream.headers["content-length"])
        if (declaredSize > maximumBytes) throw new ImageProxyError(413, "图片超过 20 MiB，请使用更小的图片。")

        const source = upstream
        const iterator = source[Symbol.asyncIterator]()
        // Read before sending headers so empty responses and initial network failures
        // remain normal HTTP errors. Later failures deliberately error the stream.
        let pending = await abortable(iterator.next(), controller.signal)
        if (pending.done) throw new ImageProxyError(502, "原站返回了空图片。")
        let bytes = 0

        const body = new ReadableStream<Uint8Array>({
            async pull(stream) {
                try {
                    controller.signal.throwIfAborted()
                    const chunk = pending

                    if (chunk.done) {
                        if (Number.isFinite(declaredSize) && declaredSize > 0 && bytes !== declaredSize) throw new Error("图片传输不完整")
                        cleanup()
                        stream.close()
                        return
                    }

                    bytes += chunk.value.byteLength
                    if (bytes > maximumBytes) throw new ImageProxyError(413, "图片超过 20 MiB，请使用更小的图片。")
                    stream.enqueue(new Uint8Array(chunk.value))
                    pending = await abortable(iterator.next(), controller.signal)
                } catch (error) {
                    source.destroy()
                    controller.abort(error)
                    cleanup()
                    stream.error(error)
                }
            },
            cancel() {
                source.destroy()
                controller.abort()
                cleanup()
            },
        })

        return new Response(body, {
            headers: {
                ...responseHeaders,
                "Content-Type": type,
                "Content-Security-Policy": "default-src 'none'; sandbox",
                "Content-Disposition": "inline",
            },
        })
    } catch (cause) {
        upstream?.destroy()
        cleanup()
        const error = controller.signal.aborted && controller.signal.reason instanceof ImageProxyError ? controller.signal.reason : cause
        const status = error instanceof ImageProxyError ? error.status : request.signal.aborted ? 499 : 502
        return Response.json(
            { message: error instanceof ImageProxyError ? error.message : "图片获取失败，请检查地址和网络后重试。" },
            { status, headers: responseHeaders },
        )
    }
}
