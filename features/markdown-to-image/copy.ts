import { type ExportDocumentParams, exportDocument } from "./export"
import { ExportFormat } from "./model"

export type CopyDocumentParams = Pick<ExportDocumentParams, "element" | "pixelRatio">

export async function copyDocument(params: CopyDocumentParams): Promise<void> {
    if (!window.isSecureContext) throw new Error("复制图片需要安全连接，请通过 HTTPS 或 localhost 打开页面后重试。")
    if (
        typeof navigator.clipboard?.write !== "function" ||
        typeof ClipboardItem !== "function" ||
        (typeof ClipboardItem.supports === "function" && !ClipboardItem.supports("image/png"))
    )
        throw new Error("当前浏览器不支持复制图片，请使用新版浏览器，或通过导出按钮下载图片。")

    const image = exportDocument({ ...params, format: ExportFormat.PNG })
    let write: Promise<void>

    try {
        // 在点击的用户手势内发起写入，图片异步生成交给 ClipboardItem 等待。
        write = navigator.clipboard.write([new ClipboardItem({ "image/png": image })])
    } catch (error) {
        write = Promise.reject(error)
    }

    // 写入可能提前被拒绝，仍需等待截图清理完成再允许编辑，并接住两端的异常。
    const [imageResult, writeResult] = await Promise.allSettled([image, write])
    if (imageResult.status === "rejected") throw imageResult.reason

    if (writeResult.status === "rejected") {
        if ((writeResult.reason instanceof Error || writeResult.reason instanceof DOMException) && writeResult.reason.name === "NotAllowedError")
            throw new Error("浏览器未允许复制图片，请允许剪贴板访问并保持页面在前台后重试，或通过导出按钮下载图片。", { cause: writeResult.reason })
        throw new Error("图片未能写入剪贴板，请重试，或通过导出按钮下载图片。", { cause: writeResult.reason })
    }
}
