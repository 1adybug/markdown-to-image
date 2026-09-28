import { describe, expect, it, vi } from "vitest"

import { countGraphemes, decodeMarkdown, MAX_MARKDOWN_FILE_BYTES, readMarkdownFile } from "./import-markdown"

describe("Markdown decoding", () => {
    it("preserves Markdown, Chinese punctuation, internal BOM, and CRLF exactly", () => {
        const source = "# 中文與繁體\r\n**（内容）**\r\n\r\n\ufeff\t代码 🌿\n"
        expect(decodeMarkdown({ buffer: new TextEncoder().encode(source).buffer })).toBe(source)
    })

    it("strips the UTF-8 byte-order mark only at the beginning", () => {
        const source = "\ufeff你好\ufeff"
        expect(decodeMarkdown({ buffer: new TextEncoder().encode(source).buffer })).toBe("你好\ufeff")
    })

    it.each([
        [0xff, 0xfe, 0x2d, 0x4e, 0x87, 0x65, 0x0a, 0x00],
        [0xfe, 0xff, 0x4e, 0x2d, 0x65, 0x87, 0x00, 0x0a],
    ])(
        "recognizes UTF-16 BOM without mistaking zero bytes for binary data",
        (...bytes) => void expect(decodeMarkdown({ buffer: new Uint8Array(bytes).buffer })).toBe("中文\n"),
    )

    it("does not guess GB18030 after UTF-8 fails, but supports explicit selection", () => {
        const buffer = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]).buffer
        expect(() => decodeMarkdown({ buffer })).toThrow("GB18030")
        expect(decodeMarkdown({ buffer, encoding: "gb18030" })).toBe("中文")
    })

    it("rejects malformed bytes instead of silently inserting replacement characters", () => {
        expect(() => decodeMarkdown({ buffer: new Uint8Array([0xe4, 0xb8]).buffer })).toThrow("解码")
        expect(() => decodeMarkdown({ buffer: new Uint8Array([0x81]).buffer, encoding: "gb18030" })).toThrow("解码")
        expect(() => decodeMarkdown({ buffer: new Uint8Array([0xff, 0xfe, 0x2d]).buffer })).toThrow("UTF-16")
    })

    it("rejects binary NUL characters after decoding", () =>
        void expect(() => decodeMarkdown({ buffer: new TextEncoder().encode("content\0data").buffer })).toThrow("二进制"))

    it("accepts an empty document", () => void expect(decodeMarkdown({ buffer: new ArrayBuffer(0) })).toBe(""))
})

describe("Markdown file import", () => {
    it.each(["笔记.md", "繁體.markdown", "NOTES.TXT"])("reads %s without modifying contents", async name => {
        const source = "**你好：**\r\n第二行"
        await expect(readMarkdownFile({ file: new File([source], name) })).resolves.toBe(source)
    })

    it("rejects unsupported extensions before reading", async () => {
        const file = new File(["content"], "file.pdf")
        const read = vi.spyOn(file, "arrayBuffer")
        await expect(readMarkdownFile({ file })).rejects.toThrow(".md")
        expect(read).not.toHaveBeenCalled()
    })

    it("rejects oversized input before reading", async () => {
        const file = new File([new Uint8Array(MAX_MARKDOWN_FILE_BYTES + 1)], "large.md")
        const read = vi.spyOn(file, "arrayBuffer")
        await expect(readMarkdownFile({ file })).rejects.toThrow("2 MiB")
        expect(read).not.toHaveBeenCalled()
    })

    it("propagates useful read errors", async () => {
        const file = new File(["内容"], "notes.md")
        vi.spyOn(file, "arrayBuffer").mockRejectedValue(new Error("Read failed"))
        await expect(readMarkdownFile({ file })).rejects.toThrow("无法读取文件")
    })
})

describe("grapheme counts", () =>
    void it.each([
        ["", 0],
        ["中文𠀀", 3],
        ["👨‍👩‍👧‍👦👍🏽🇨🇳", 3],
        ["e\u0301", 1],
        ["a\r\nb", 3],
    ])("counts user-perceived characters in %s", (text, count) => void expect(countGraphemes(text)).toBe(count)))
