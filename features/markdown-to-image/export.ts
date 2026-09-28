import type { DocumentSettings } from "./model"

const resourceTimeout = 20_000
const maximumDimension = 16_384
const maximumPixels = 16_777_216

export interface CalculateExportSizeParams {
    width: number
    height: number
    pixelRatio: DocumentSettings["pixelRatio"]
}

export function calculateExportSize(params: CalculateExportSizeParams) {
    const { width, height, pixelRatio } = params
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error("文稿尺寸为空或无效，请等待预览显示后重试。")
    if (![1, 2, 3].includes(pixelRatio)) throw new Error("导出倍率必须是 1、2 或 3 倍。")

    const layoutWidth = Math.ceil(width)
    const layoutHeight = Math.ceil(height)
    const pixelWidth = layoutWidth * pixelRatio
    const pixelHeight = layoutHeight * pixelRatio
    if (pixelWidth > maximumDimension || pixelHeight > maximumDimension || pixelWidth * pixelHeight > maximumPixels)
        throw new Error("图片尺寸超过导出上限（单边 16384 像素、总计 1677 万像素），请降低倍率或缩短文稿后重试。")
    return { width: layoutWidth, height: layoutHeight, pixelWidth, pixelHeight }
}

interface WithTimeoutParams<T> {
    promise: Promise<T>
    message: string
    timeout?: number
}

function withTimeout<T>(params: WithTimeoutParams<T>) {
    let timer: ReturnType<typeof setTimeout>
    return Promise.race([
        params.promise,
        new Promise<never>((_, reject) => void (timer = setTimeout(() => reject(new Error(params.message)), params.timeout ?? resourceTimeout))),
    ]).finally(() => clearTimeout(timer))
}

async function waitForLayout(ownerWindow: Window) {
    await withTimeout({
        promise: new Promise<void>(resolve => ownerWindow.requestAnimationFrame(() => ownerWindow.requestAnimationFrame(() => resolve()))),
        message: "预览尚未完成布局，请保持页面可见后重试。",
        timeout: 5000,
    })
}

function readAsDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error("导出资源读取失败，请重试。"))
        reader.onabort = () => reject(new Error("导出资源读取已中断，请重试。"))
        reader.readAsDataURL(blob)
    })
}

function normalizeFamily(value: string) {
    return value
        .trim()
        .replace(/^["']|["']$/g, "")
        .toLowerCase()
}

function collectFonts(element: HTMLElement) {
    const ownerWindow = element.ownerDocument.defaultView!
    const families = new Map<string, Set<number>>()
    const loads = new Map<string, Set<string>>()
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let node: Node | null

    while ((node = walker.nextNode())) {
        const parent = node.parentElement
        const text = node.textContent
        if (!parent || !text?.trim()) continue
        const style = ownerWindow.getComputedStyle(parent)
        if (style.display === "none" || style.visibility === "hidden") continue
        const content = parent.closest("li") ? `${text}0123456789. •` : text
        const font = `${style.fontStyle || "normal"} ${style.fontWeight || "400"} ${style.fontSize || "16px"} ${style.fontFamily}`
        const characters = loads.get(font) ?? new Set<string>()
        Array.from(content).forEach(character => characters.add(character))
        loads.set(font, characters)

        for (const family of style.fontFamily.split(",").map(normalizeFamily)) {
            const codePoints = families.get(family) ?? new Set<number>()
            Array.from(content).forEach(character => codePoints.add(character.codePointAt(0)!))
            families.set(family, codePoints)
        }
    }

    return { families, loads }
}

interface IncludesCharactersParams {
    unicodeRange: string
    codePoints: Set<number>
}

function includesCharacters(params: IncludesCharactersParams) {
    if (!params.unicodeRange) return true
    return params.unicodeRange.split(",").some(range => {
        const match = range.trim().match(/^U\+([\da-f?]+)(?:-([\da-f]+))?$/i)
        if (!match) throw new Error("字体的 Unicode 范围无法识别，无法保证图片中文字完整。")
        const start = Number.parseInt(match[1].replaceAll("?", "0"), 16)
        const end = Number.parseInt(match[2] ?? match[1].replaceAll("?", "f"), 16)
        return [...params.codePoints].some(codePoint => codePoint >= start && codePoint <= end)
    })
}

function collectFontRules(ownerDocument: Document) {
    const fontRules: CSSFontFaceRule[] = []

    const visited = new Set<CSSStyleSheet>()

    function visitRules(rules: CSSRuleList) {
        for (const rule of Array.from(rules)) {
            if (rule instanceof CSSFontFaceRule) fontRules.push(rule)
            else if (rule instanceof CSSImportRule) {
                const sheet = rule.styleSheet
                if (sheet) visitSheet(sheet)
            } else if ("cssRules" in rule) visitRules((rule as CSSGroupingRule).cssRules)
        }
    }

    function visitSheet(sheet: CSSStyleSheet) {
        if (visited.has(sheet) || sheet.disabled) return
        visited.add(sheet)

        try {
            visitRules(sheet.cssRules)
        } catch {
            throw new Error("无法读取页面字体样式，请确认样式资源允许跨域读取后重试。")
        }
    }

    Array.from(ownerDocument.styleSheets).forEach(visitSheet)
    return fontRules
}

interface PrepareFontsParams {
    element: HTMLElement
    fetchResource: (url: string) => Promise<string>
}

async function prepareFonts(params: PrepareFontsParams) {
    const { element, fetchResource } = params
    const ownerDocument = element.ownerDocument
    const fontSet = ownerDocument.fonts
    if (!fontSet) throw new Error("当前浏览器无法检查字体加载状态，请使用支持 Font Loading API 的浏览器导出。")
    const { families, loads } = collectFonts(element)

    try {
        await withTimeout({
            promise: Promise.all(
                [...loads].map(async ([font, characters]) => {
                    const text = [...characters].join("")
                    const faces = await fontSet.load(font, text)
                    if (faces.some(face => face.status !== "loaded") || !fontSet.check(font, text)) throw new Error("字体未加载完成")
                }),
            ),
            message: "字体加载超时，请检查网络后重试。",
        })
        await withTimeout({ promise: fontSet.ready, message: "字体加载超时，请检查网络后重试。" })
    } catch (cause) {
        throw new Error("文稿字体加载失败或超时，请检查网络后重试，避免导出缺字或替代字体。", { cause })
    }

    // 截图库会吞掉字体下载异常，并嵌入同一字体的全部分片；这里按实际字符筛选并提前完整嵌入。
    const rules = collectFontRules(ownerDocument).filter(rule => {
        const codePoints = families.get(normalizeFamily(rule.style.getPropertyValue("font-family")))
        return codePoints && includesCharacters({ unicodeRange: rule.style.getPropertyValue("unicode-range"), codePoints })
    })

    try {
        return (
            await Promise.all(
                rules.map(async rule => {
                    const src = rule.style.getPropertyValue("src")

                    const sources = [...src.matchAll(/url\((?:"([^"]+)"|'([^']+)'|([^)'"\s]+))\)(?:\s*format\([^)]*\))?/g)]

                    const source = sources.find(candidate => /woff2/i.test(candidate[0])) ?? sources[0]
                    if (!source) throw new Error("字体没有可嵌入的文件来源")
                    const url = new URL(source[1] ?? source[2] ?? source[3], rule.parentStyleSheet?.href ?? ownerDocument.baseURI).href
                    const dataUrl = await fetchResource(url)
                    const embedded = source[0].replace(/url\([^)]*\)/, `url("${dataUrl}")`)

                    const declarations = Array.from(rule.style)
                        .map(property => `${property}: ${property === "src" ? embedded : rule.style.getPropertyValue(property)};`)
                        .join("\n")

                    return `@font-face { ${declarations} }`
                }),
            )
        ).join("\n")
    } catch (cause) {
        throw new Error("字体文件无法嵌入图片，请检查网络及字体资源的跨域设置后重试。", { cause })
    }
}

async function waitForImage(image: HTMLImageElement) {
    const src = image.currentSrc || image.src
    const label = image.alt ? `“${image.alt}”` : "文稿中的图片"
    if (!src) throw new Error(`${label}没有图片地址，请修正后导出。`)

    if (!image.complete) {
        await new Promise<void>((resolve, reject) => {
            const finish = (error?: Error) => {
                clearTimeout(timer)
                image.removeEventListener("load", loaded)
                image.removeEventListener("error", failed)

                if (error) reject(error)
                else resolve()
            }

            const loaded = () => finish()
            const failed = () => finish(new Error(`${label}加载失败，请修正图片地址后重试。`))
            const timer = setTimeout(() => finish(new Error(`${label}加载超时，请检查网络后重试。`)), resourceTimeout)
            image.addEventListener("load", loaded, { once: true })
            image.addEventListener("error", failed, { once: true })
        })
    }

    if (!image.naturalWidth || !image.naturalHeight) throw new Error(`${label}加载失败，请修正图片地址后重试。`)

    try {
        await withTimeout({ promise: image.decode(), message: `${label}解码超时。` })
    } catch (cause) {
        throw new Error(`${label}无法解码，请使用浏览器支持的图片格式后重试。`, { cause })
    }
}

function measureDocument(element: HTMLElement) {
    const style = element.ownerDocument.defaultView!.getComputedStyle(element)
    const number = (property: string) => Number.parseFloat(style.getPropertyValue(property)) || 0
    const borderWidth = number("border-left-width") + number("border-right-width")
    const borderHeight = number("border-top-width") + number("border-bottom-width")
    const width = number("width") + (style.boxSizing === "border-box" ? 0 : number("padding-left") + number("padding-right") + borderWidth)
    const height = number("height") + (style.boxSizing === "border-box" ? 0 : number("padding-top") + number("padding-bottom") + borderHeight)
    // offset/computed 尺寸不受祖先的预览 transform 影响；向上取整避免截掉不足一像素的末行。
    return { width: Math.max(width, element.offsetWidth), height: Math.max(height, element.offsetHeight, element.scrollHeight + borderHeight) }
}

function assertImagesAvailable(element: HTMLElement) {
    if (element.querySelector('[data-image-error="true"]')) throw new Error("文稿中有无法加载的图片，请检查图片地址和跨域访问权限，修正后再导出。")
}

export interface ExportDocumentParams {
    element: HTMLElement
    pixelRatio: DocumentSettings["pixelRatio"]
    filename?: string
}

export async function exportDocument(params: ExportDocumentParams): Promise<Blob> {
    const { element, pixelRatio } = params
    const ownerWindow = element.ownerDocument.defaultView
    if (!ownerWindow || !element.isConnected) throw new Error("预览尚未就绪，请等待文稿显示后重试。")
    assertImagesAvailable(element)
    const controller = new AbortController()
    const resources = new Map<string, Promise<string>>()
    let resourceError: Error | undefined

    const fetchResource = (rawUrl: string) => {
        const url = new URL(rawUrl, element.ownerDocument.baseURI).href
        let promise = resources.get(url)

        if (!promise) {
            promise = withTimeout({
                promise: fetch(url, { mode: "cors", credentials: "same-origin", cache: "force-cache", signal: controller.signal }).then(async response => {
                    if (!response.ok || response.type === "opaque") throw new Error("资源响应不可读取")
                    const blob = await response.blob()
                    if (!blob.size) throw new Error("资源为空")
                    return readAsDataUrl(blob)
                }),
                message: "图片或字体资源加载超时，请检查网络后重试。",
            }).catch(cause => {
                resourceError = new Error("图片或字体无法嵌入，请确认地址可访问且允许跨域读取（CORS）后重试。", { cause })
                throw resourceError
            })
            resources.set(url, promise)
        }

        return promise
    }

    let cleanup: (() => void) | undefined

    try {
        await waitForLayout(ownerWindow)
        const images = Array.from(element.querySelectorAll("img"))
        const [fontCssText] = await Promise.all([
            prepareFonts({ element, fetchResource }),
            Promise.all(
                images.map(async image => {
                    await waitForImage(image)
                    await fetchResource(image.currentSrc || image.src)
                }),
            ),
        ])
        await waitForLayout(ownerWindow)
        assertImagesAvailable(element)
        if (element.scrollWidth > element.clientWidth + 1) throw new Error("文稿中仍有超出画布宽度的内容，请调整画布或内容后导出。")
        const size = calculateExportSize({ ...measureDocument(element), pixelRatio })
        const { createContext, destroyContext, domToBlob } = await import("modern-screenshot")
        const context = await createContext(element, {
            width: size.width,
            height: size.height,
            scale: pixelRatio,
            type: "image/png",
            maximumCanvasSize: 0,
            timeout: resourceTimeout,
            font: fontCssText ? { cssText: fontCssText } : false,
            fetchFn: fetchResource,
            fetch: { placeholderImage: "" },
            style: { transform: "none", margin: "0", boxSizing: "border-box" },
            onEmbedNode: () => {
                // 库内部的资源任务会 catch 后继续，必须在生成图片前重新抛出下载失败。
                if (resourceError) throw resourceError
            },
            onCreateForeignObjectSvg: async svg => {
                const image = element.ownerDocument.createElement("img")
                image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
                await waitForImage(image)
            },
        })
        cleanup = () => destroyContext(context)
        const blob = await domToBlob(context)
        if (!blob.size || blob.type !== "image/png") throw new Error("浏览器未能生成有效的 PNG 图片，请降低倍率后重试。")
        const header = new DataView(await blob.slice(0, 24).arrayBuffer())
        if (
            header.byteLength < 24 ||
            header.getUint32(0) !== 0x89504e47 ||
            header.getUint32(16) !== size.pixelWidth ||
            header.getUint32(20) !== size.pixelHeight
        )
            throw new Error("生成的图片尺寸不完整，请降低倍率或缩短文稿后重试。")
        return blob
    } catch (cause) {
        if (cause instanceof Error && /[\u3400-\u9fff]/u.test(cause.message)) throw cause
        throw new Error("图片导出失败，请检查资源是否可用，或降低倍率后重试。", { cause })
    } finally {
        controller.abort()
        cleanup?.()
        resources.clear()
    }
}
