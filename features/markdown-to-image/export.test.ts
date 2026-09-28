import type { Options } from "modern-screenshot"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { calculateExportSize, exportDocument } from "./export"

const screenshot = vi.hoisted(() => ({ createContext: vi.fn(), destroyContext: vi.fn(), domToBlob: vi.fn() }))
vi.mock("modern-screenshot", () => screenshot)

interface PngBlobParams {
    width?: number
    height?: number
}

function pngBlob(params: PngBlobParams = {}) {
    const bytes = new Uint8Array(24)
    const header = new DataView(bytes.buffer)
    header.setUint32(0, 0x89504e47)
    header.setUint32(16, params.width ?? 720)
    header.setUint32(20, params.height ?? 480)
    const blob = new Blob([bytes], { type: "image/png" })

    // jsdom 的 Blob 尚未实现 arrayBuffer；生产浏览器从真实 PNG 的 IHDR 读取尺寸。
    vi.spyOn(blob, "slice").mockReturnValue({ arrayBuffer: async () => bytes.buffer } as Blob)

    return blob
}

function createDocument() {
    const element = document.createElement("article")
    element.style.cssText = "width:360px;height:240px;box-sizing:border-box;font-family:TestFont;font-size:18px"
    element.textContent = "中文 ABC"

    Object.defineProperties(element, {
        offsetWidth: { value: 360 },
        offsetHeight: { value: 240 },
        clientWidth: { value: 360 },
        scrollWidth: { value: 360 },
        scrollHeight: { value: 240 },
    })

    document.body.append(element)
    return element
}

interface AddImageParams {
    element: HTMLElement
    complete?: boolean
    valid?: boolean
    decode?: () => Promise<void>
}

function addImage(params: AddImageParams) {
    const image = document.createElement("img")
    image.src = "https://images.example.test/photo.png"
    image.alt = "中文示例配图"

    Object.defineProperties(image, {
        complete: { value: params.complete ?? true },
        naturalWidth: { value: params.valid === false ? 0 : 120 },
        naturalHeight: { value: params.valid === false ? 0 : 80 },
        decode: { value: params.decode ?? vi.fn().mockResolvedValue(undefined) },
    })

    params.element.append(image)
    return image
}

interface FontRule {
    family: string
    src: string
    range?: string
}

function addFontRules(rules: FontRule[]) {
    const style = document.createElement("style")
    style.dataset.exportTest = "true"
    style.textContent = rules.map(rule => `@font-face { font-family: ${rule.family}; }`).join("\n")
    document.head.append(style)

    // jsdom 会丢弃 @font-face 的 src/unicode-range 描述符，使用浏览器 CSSOM 形状补齐测试数据。
    rules.forEach((rule, index) => {
        const declarations: Record<string, string> = { "font-family": rule.family, src: rule.src, "unicode-range": rule.range ?? "" }

        Object.defineProperty(style.sheet!.cssRules[index], "style", {
            value: { 0: "font-family", 1: "src", 2: "unicode-range", length: 3, getPropertyValue: (key: string) => declarations[key] ?? "" },
        })
    })
}

const fonts = { ready: Promise.resolve(), load: vi.fn(), check: vi.fn() }

beforeEach(() => {
    document.body.replaceChildren()
    fonts.load.mockReset().mockResolvedValue([{ status: "loaded" }])
    fonts.check.mockReset().mockReturnValue(true)
    Object.defineProperty(document, "fonts", { configurable: true, value: fonts })

    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
        callback(0)
        return 1
    })

    screenshot.createContext.mockReset().mockImplementation(async (element: HTMLElement, options: Options) => ({ node: element, ...options }))
    screenshot.domToBlob.mockReset().mockImplementation(async () => pngBlob())
    screenshot.destroyContext.mockReset()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, type: "basic", blob: async () => new Blob(["resource"]) }))
})

afterEach(() => {
    document.head.querySelectorAll("style[data-export-test]").forEach(style => style.remove())
    vi.unstubAllGlobals()
})

describe("导出尺寸", () => {
    it("按未缩放布局尺寸向上取整，再应用输出倍率", () =>
        void expect(calculateExportSize({ width: 720, height: 100.25, pixelRatio: 3 })).toEqual({
            width: 720,
            height: 101,
            pixelWidth: 2160,
            pixelHeight: 303,
        }))

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
        "拒绝无效或空尺寸 %s",
        width => void expect(() => calculateExportSize({ width, height: 100, pixelRatio: 1 })).toThrow("尺寸为空或无效"),
    )

    it("接受边界尺寸，拒绝超出单边或总像素上限的图片", () => {
        expect(calculateExportSize({ width: 16_384, height: 1, pixelRatio: 1 }).pixelWidth).toBe(16_384)
        expect(calculateExportSize({ width: 4096, height: 4096, pixelRatio: 1 }).pixelHeight).toBe(4096)
        expect(() => calculateExportSize({ width: 16_385, height: 1, pixelRatio: 1 })).toThrow("超过导出上限")
        expect(() => calculateExportSize({ width: 4096, height: 4097, pixelRatio: 1 })).toThrow("超过导出上限")
    })
})

describe("文稿导出", () => {
    it("独立于预览祖先缩放，显式设置尺寸并返回 PNG", async () => {
        const element = createDocument()
        element.parentElement!.style.transform = "scale(0.5)"
        vi.spyOn(element, "getBoundingClientRect").mockReturnValue({ width: 180, height: 120 } as DOMRect)
        const blob = await exportDocument({ element, pixelRatio: 2 })
        expect(blob.type).toBe("image/png")
        expect(screenshot.createContext).toHaveBeenCalledWith(element, expect.objectContaining({ width: 360, height: 240, scale: 2, maximumCanvasSize: 0 }))
        expect(screenshot.destroyContext).toHaveBeenCalledOnce()
        element.parentElement!.style.transform = ""
    })

    it("字体加载失败时阻止导出", async () => {
        fonts.load.mockRejectedValue(new Error("Font download failed"))
        await expect(exportDocument({ element: createDocument(), pixelRatio: 2 })).rejects.toThrow("文稿字体加载失败")
        expect(screenshot.domToBlob).not.toHaveBeenCalled()
    })

    it("字体加载完成但仍未满足文稿字形需求时阻止导出", async () => {
        fonts.check.mockReturnValue(false)
        await expect(exportDocument({ element: createDocument(), pixelRatio: 2 })).rejects.toThrow("文稿字体加载失败")
    })

    it("只嵌入当前字体中与实际字符相交的 Unicode 分片", async () => {
        addFontRules([
            { family: "TestFont", src: "url(/latin.woff2) format('woff2')", range: "U+0-7F" },
            { family: "TestFont", src: "url(/chinese.woff2) format('woff2')", range: "U+4E00-9FFF" },
            { family: "TestFont", src: "url(/unused.woff2) format('woff2')", range: "U+1F900-1F9FF" },
            { family: "UnusedFamily", src: "url(/other.woff2) format('woff2')" },
        ])

        await exportDocument({ element: createDocument(), pixelRatio: 2 })
        expect(fetch).toHaveBeenCalledTimes(2)
        const options = screenshot.createContext.mock.calls[0][1] as Options
        expect(options.font).toEqual({ cssText: expect.stringContaining("data:") })
        expect(options.font && options.font.cssText).not.toContain("unused.woff2")
    })

    it("字体文件无法嵌入时不能悄悄导出替代字体", async () => {
        addFontRules([{ family: "TestFont", src: "url(/failed.woff2)" }])
        vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"))
        await expect(exportDocument({ element: createDocument(), pixelRatio: 2 })).rejects.toThrow("字体文件无法嵌入")
    })

    it("按默认字体列表匹配带引号的字体名以及多个逗号分隔的 Unicode 范围", async () => {
        addFontRules([
            { family: "'Inter Variable'", src: "url(/inter.woff2)", range: "U+0000-00FF,U+0131,U+0152-0153" },
            { family: "'Noto Sans SC Variable'", src: "url(/noto.woff2)", range: "U+3000-303F,U+4E00-9FFF" },
            { family: "'Noto Sans SC Variable'", src: "url(/noto-unused.woff2)", range: "U+0301,U+0358,U+1EA0-1EF9" },
        ])

        const element = createDocument()
        element.style.fontFamily = '"Inter Variable", "Noto Sans SC Variable", sans-serif'
        await exportDocument({ element, pixelRatio: 2 })
        expect(fetch).toHaveBeenCalledTimes(2)
        const options = screenshot.createContext.mock.calls[0][1] as Options
        expect(options.font && options.font.cssText).toContain("Inter Variable")
        expect(options.font && options.font.cssText).toContain("Noto Sans SC Variable")
    })

    it("使用完整 Unicode 码点选择生僻汉字与 Emoji 字体分片", async () => {
        addFontRules([
            { family: "TestFont", src: "url(/rare-chinese.woff2)", range: "U+20000-2FFFF" },
            { family: "TestFont", src: "url(/emoji.woff2)", range: "U+1F3??" },
            { family: "TestFont", src: "url(/unused-latin.woff2)", range: "U+0-7F" },
        ])

        const element = createDocument()
        element.textContent = "𠀀🌿"
        await exportDocument({ element, pixelRatio: 2 })
        expect(fetch).toHaveBeenCalledTimes(2)
        expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual(
            expect.arrayContaining([expect.stringContaining("rare-chinese"), expect.stringContaining("emoji")]),
        )
    })

    it("已加载但损坏的图片阻止导出", async () => {
        const element = createDocument()
        addImage({ element, valid: false })
        await expect(exportDocument({ element, pixelRatio: 2 })).rejects.toThrow("中文示例配图”加载失败")
    })

    it("渲染器已把失败图片换成错误提示时仍阻止导出", async () => {
        const element = createDocument()
        element.insertAdjacentHTML("beforeend", '<span data-image-error="true">图片无法加载</span>')
        await expect(exportDocument({ element, pixelRatio: 2 })).rejects.toThrow("文稿中有无法加载的图片")
        expect(screenshot.createContext).not.toHaveBeenCalled()
    })

    it("等待资源期间渲染器出现图片错误时，在截图前再次阻止导出", async () => {
        const element = createDocument()

        fonts.load.mockImplementationOnce(async () => {
            element.insertAdjacentHTML("beforeend", '<span data-image-error="true">图片无法加载</span>')
            return [{ status: "loaded" }]
        })

        await expect(exportDocument({ element, pixelRatio: 2 })).rejects.toThrow("文稿中有无法加载的图片")
        expect(screenshot.createContext).not.toHaveBeenCalled()
    })

    it("等待中的图片触发 error 时立即中止", async () => {
        const element = createDocument()
        const image = addImage({ element, complete: false })
        const promise = exportDocument({ element, pixelRatio: 2 })
        setTimeout(() => image.dispatchEvent(new Event("error")), 0)
        await expect(promise).rejects.toThrow("加载失败")
    })

    it("图片不能解码时阻止导出", async () => {
        const element = createDocument()
        addImage({ element, decode: vi.fn().mockRejectedValue(new Error("EncodingError")) })
        await expect(exportDocument({ element, pixelRatio: 2 })).rejects.toThrow("无法解码")
    })

    it("图片显示正常但不允许 CORS 读取时明确失败", async () => {
        const element = createDocument()
        addImage({ element })
        vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"))
        await expect(exportDocument({ element, pixelRatio: 2 })).rejects.toThrow("跨域读取（CORS）")
        expect(screenshot.domToBlob).not.toHaveBeenCalled()
    })

    it("导出器重复读取图片时复用预检结果", async () => {
        const element = createDocument()
        const image = addImage({ element })

        screenshot.domToBlob.mockImplementation(async (context: Options) => {
            await context.fetchFn!(image.src)
            return pngBlob()
        })

        await exportDocument({ element, pixelRatio: 2 })
        expect(fetch).toHaveBeenCalledOnce()
    })

    it("截图依赖吞掉异步资源错误时在生成图片前重新阻断，并释放上下文", async () => {
        vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"))

        screenshot.domToBlob.mockImplementation(async (context: Options) => {
            await context.fetchFn!("https://images.example.test/background.png").catch(() => undefined)
            await context.onEmbedNode!(document.createElement("div"))
            return pngBlob()
        })

        await expect(exportDocument({ element: createDocument(), pixelRatio: 2 })).rejects.toThrow("跨域读取（CORS）")
        expect(screenshot.destroyContext).toHaveBeenCalledOnce()
    })

    it("拒绝空图片，并允许后续重试", async () => {
        const element = createDocument()
        screenshot.domToBlob.mockResolvedValueOnce(new Blob([], { type: "image/png" }))
        await expect(exportDocument({ element, pixelRatio: 2 })).rejects.toThrow("有效的 PNG")
        await expect(exportDocument({ element, pixelRatio: 2 })).resolves.toBeInstanceOf(Blob)
        expect(screenshot.destroyContext).toHaveBeenCalledTimes(2)
    })

    it("拒绝被底层库自动缩小或截断的输出", async () => {
        screenshot.domToBlob.mockResolvedValueOnce(pngBlob({ width: 360, height: 240 }))
        await expect(exportDocument({ element: createDocument(), pixelRatio: 2 })).rejects.toThrow("图片尺寸不完整")
    })
})
