export type MarkdownEncoding = "utf-8" | "gb18030"

export const MAX_MARKDOWN_FILE_BYTES = 2 * 1024 * 1024

export interface DecodeMarkdownParams {
    buffer: ArrayBuffer
    encoding?: MarkdownEncoding
}

export function decodeMarkdown(params: DecodeMarkdownParams): string {
    const { buffer, encoding = "utf-8" } = params
    const bytes = new Uint8Array(buffer)
    let decoderEncoding: string = encoding

    // An explicit BOM identifies the encoding; zero bytes in UTF-16 are not binary content.
    if (bytes[0] === 0xff && bytes[1] === 0xfe) decoderEncoding = "utf-16le"
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) decoderEncoding = "utf-16be"
    else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) decoderEncoding = "utf-8"

    let text: string

    try {
        text = new TextDecoder(decoderEncoding, { fatal: true }).decode(bytes)
    } catch {
        if (decoderEncoding.startsWith("utf-16")) throw new Error("无法按文件标记的 UTF-16 编码解码，请确认文件完整，或将文件另存为 UTF-8 后重试。")

        throw new Error(
            encoding === "utf-8"
                ? "无法按 UTF-8 解码文件，请尝试选择 GB18030 编码后重新导入。"
                : "无法按所选编码解码文件，请确认文件编码，或将文件另存为 UTF-8 后重试。",
        )
    }

    if (text.includes("\0")) throw new Error("文件包含二进制内容，无法作为 Markdown 导入。请选择纯文本文件。")

    return text
}

export interface ReadMarkdownFileParams {
    file: File
    encoding?: MarkdownEncoding
}

export async function readMarkdownFile(params: ReadMarkdownFileParams): Promise<string> {
    const { file, encoding } = params
    if (!/\.(?:md|markdown|txt)$/iu.test(file.name)) throw new Error("请选择 .md、.markdown 或 .txt 文件。")

    if (file.size > MAX_MARKDOWN_FILE_BYTES) throw new Error("文件超过 2 MiB，请缩小文件后再导入。")

    let buffer: ArrayBuffer

    try {
        buffer = await file.arrayBuffer()
    } catch {
        throw new Error("无法读取文件，请重新选择文件后重试。")
    }

    return decodeMarkdown({ buffer, encoding })
}

const graphemeSegmenter = new Intl.Segmenter("zh", { granularity: "grapheme" })

export function countGraphemes(text: string): number {
    const segments = graphemeSegmenter.segment(text)[Symbol.iterator]()
    let count = 0

    while (!segments.next().done) count += 1

    return count
}
