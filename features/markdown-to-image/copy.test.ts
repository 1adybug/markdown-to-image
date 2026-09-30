import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { copyDocument } from "./copy"
import { exportDocument } from "./export"
import { ExportFormat } from "./model"

vi.mock("./export", () => ({ exportDocument: vi.fn() }))

const exportMock = vi.mocked(exportDocument)
const write = vi.fn<(items: ClipboardItem[]) => Promise<void>>()
const supports = vi.fn<(type: string) => boolean>()

const clipboardData: Record<string, Promise<Blob>>[] = []

let constructorError: Error | undefined

function copyParams() {
    return { element: document.createElement("article"), pixelRatio: 4 as const }
}

beforeEach(() => {
    clipboardData.length = 0
    constructorError = undefined
    exportMock.mockReset().mockResolvedValue(new Blob(["PNG"], { type: "image/png" }))
    write.mockReset().mockResolvedValue(undefined)
    supports.mockReset().mockReturnValue(true)
    vi.stubGlobal("isSecureContext", true)
    vi.stubGlobal("navigator", { clipboard: { write } })

    vi.stubGlobal(
        "ClipboardItem",
        class {
            static supports = supports

            constructor(data: Record<string, Promise<Blob>>) {
                if (constructorError) throw constructorError
                clipboardData.push(data)
            }
        },
    )
})

afterEach(() => void vi.unstubAllGlobals())

describe("图片复制", () => {
    it("在生成完成前同步写入 PNG Promise，并保留输出倍率", async () => {
        const pending = Promise.withResolvers<Blob>()
        exportMock.mockReturnValueOnce(pending.promise)
        const params = copyParams()
        const result = copyDocument(params)
        const settled = vi.fn()
        const completion = result.then(settled)

        expect(write).toHaveBeenCalledOnce()
        expect(write.mock.calls[0][0]).toHaveLength(1)
        expect(supports).toHaveBeenCalledWith("image/png")
        expect(exportMock).toHaveBeenCalledWith({ ...params, format: ExportFormat.PNG })
        expect(clipboardData[0]).toEqual({ "image/png": pending.promise })
        await Promise.resolve()
        await Promise.resolve()
        expect(settled).not.toHaveBeenCalled()

        const blob = new Blob(["PNG"], { type: "image/png" })
        pending.resolve(blob)
        await completion
        await expect(clipboardData[0]["image/png"]).resolves.toBe(blob)
    })

    it("图片生成后继续等待剪贴板写入完成", async () => {
        const pending = Promise.withResolvers<void>()
        write.mockReturnValueOnce(pending.promise)
        const settled = vi.fn()
        const completion = copyDocument(copyParams()).then(settled)

        await Promise.resolve()
        await Promise.resolve()
        expect(settled).not.toHaveBeenCalled()
        pending.resolve()
        await completion
        expect(settled).toHaveBeenCalledOnce()
    })

    it("权限立即拒绝时仍等待生成结束，再返回中文权限提示", async () => {
        const pending = Promise.withResolvers<Blob>()
        exportMock.mockReturnValueOnce(pending.promise)
        write.mockRejectedValueOnce(new DOMException("Write permission denied", "NotAllowedError"))
        const result = copyDocument(copyParams())
        const settled = vi.fn()
        void result.then(settled, settled)
        const assertion = expect(result).rejects.toThrow(/权限|允许|拒绝/)

        await Promise.resolve()
        await Promise.resolve()
        expect(settled).not.toHaveBeenCalled()
        pending.resolve(new Blob(["PNG"], { type: "image/png" }))
        await assertion
    })

    it("生成和写入都失败时优先传播原始生成错误", async () => {
        const pending = Promise.withResolvers<Blob>()
        exportMock.mockReturnValueOnce(pending.promise)
        write.mockRejectedValueOnce(new DOMException("Permission denied", "NotAllowedError"))
        const result = copyDocument(copyParams())
        const error = new Error("文稿字体加载失败")
        const assertion = expect(result).rejects.toBe(error)

        await Promise.resolve()
        pending.reject(error)
        await assertion
    })

    it("ClipboardItem 构造同步失败后仍处理生成 Promise 的拒绝", async () => {
        const pending = Promise.withResolvers<Blob>()
        exportMock.mockReturnValueOnce(pending.promise)
        constructorError = new Error("Clipboard item creation failed")
        const result = copyDocument(copyParams())
        const error = new Error("图片跨域读取失败")
        const assertion = expect(result).rejects.toBe(error)
        const settled = vi.fn()
        void result.then(settled, settled)

        await Promise.resolve()
        await Promise.resolve()
        expect(settled).not.toHaveBeenCalled()
        expect(write).not.toHaveBeenCalled()
        pending.reject(error)
        await assertion
    })

    it("write 同步抛错后仍处理生成 Promise 的拒绝", async () => {
        const pending = Promise.withResolvers<Blob>()
        exportMock.mockReturnValueOnce(pending.promise)

        write.mockImplementationOnce(() => {
            throw new DOMException("Permission denied", "NotAllowedError")
        })

        const result = copyDocument(copyParams())
        const error = new Error("生成的图片尺寸不完整")
        const assertion = expect(result).rejects.toBe(error)
        const settled = vi.fn()
        void result.then(settled, settled)

        await Promise.resolve()
        await Promise.resolve()
        expect(settled).not.toHaveBeenCalled()
        pending.reject(error)
        await assertion
    })

    it("非安全上下文在生成前反馈错误", async () => {
        vi.stubGlobal("isSecureContext", false)
        await expect(copyDocument(copyParams())).rejects.toThrow(/HTTPS|安全/)
        expect(exportMock).not.toHaveBeenCalled()
        expect(write).not.toHaveBeenCalled()
    })

    it("clipboard.write 缺失时在生成前反馈不支持", async () => {
        vi.stubGlobal("navigator", { clipboard: {} })
        await expect(copyDocument(copyParams())).rejects.toThrow(/支持/)
        expect(exportMock).not.toHaveBeenCalled()
    })

    it("ClipboardItem 缺失时在生成前反馈不支持", async () => {
        vi.stubGlobal("ClipboardItem", undefined)
        await expect(copyDocument(copyParams())).rejects.toThrow(/支持/)
        expect(exportMock).not.toHaveBeenCalled()
        expect(write).not.toHaveBeenCalled()
    })

    it("明确不支持 PNG 时在生成前反馈错误", async () => {
        supports.mockReturnValue(false)
        await expect(copyDocument(copyParams())).rejects.toThrow(/支持/)
        expect(supports).toHaveBeenCalledWith("image/png")
        expect(exportMock).not.toHaveBeenCalled()
        expect(write).not.toHaveBeenCalled()
    })

    it("静态 supports 方法缺失时仍允许复制", async () => {
        Object.defineProperty(ClipboardItem, "supports", { value: undefined })
        await expect(copyDocument(copyParams())).resolves.toBeUndefined()
        expect(write).toHaveBeenCalledOnce()
    })

    it("通用剪贴板写入失败给出可读的中文提示", async () => {
        write.mockRejectedValueOnce(new Error("Native clipboard failed"))
        await expect(copyDocument(copyParams())).rejects.toThrow(/[\u3400-\u9fff]/u)
    })
})
