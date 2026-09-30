import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "react-hot-toast"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { loadDraft, saveDraft } from "./draft"
import { exportDocument } from "./export"
import { MarkdownWorkspace } from "./MarkdownWorkspace"
import { defaultSettings, ExportFormat, exportFormats, MarkdownTheme } from "./model"

vi.mock("./export", () => ({ exportDocument: vi.fn() }))
vi.mock("react-hot-toast", () => ({ toast: { success: vi.fn() } }))
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }) }))

const savedSource = "# 我的草稿\n\n保留这段中文。"
const exportMock = vi.mocked(exportDocument)

beforeEach(() => {
    localStorage.clear()
    saveDraft({ draft: { source: savedSource, settings: { ...defaultSettings } } })
    exportMock.mockReset().mockResolvedValue(new Blob(["PNG"], { type: "image/png" }))

    vi.stubGlobal("isSecureContext", true)

    vi.stubGlobal(
        "ClipboardItem",
        class {
            constructor(private data: Record<string, Promise<Blob>>) {}

            getType(type: string) {
                return this.data[type]
            }
        },
    )

    vi.stubGlobal(
        "ResizeObserver",
        class {
            observe = vi.fn()
            unobserve = vi.fn()
            disconnect = vi.fn()
        },
    )

    vi.stubGlobal(
        "URL",
        class extends URL {
            static createObjectURL = vi.fn(() => "blob:test-png")
            static revokeObjectURL = vi.fn()
        },
    )

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(vi.fn())
})

afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
})

describe("Markdown workspace interactions", () => {
    it("lists AI first and defaults to the AI theme at 2x when there is no saved draft", async () => {
        localStorage.clear()
        const user = userEvent.setup()
        render(<MarkdownWorkspace />)

        expect(screen.getAllByRole("radio")[0]).toHaveAccessibleName(/AI 风格/)
        expect(screen.getByRole("radio", { name: /AI 风格/ })).toHaveAttribute("aria-checked", "true")
        expect(screen.getByRole("button", { name: "2×" })).toHaveAttribute("aria-pressed", "true")
        expect(screen.getByRole("button", { name: "PNG" })).toHaveAttribute("aria-pressed", "true")
        await user.click(screen.getByRole("button", { name: "导出 PNG" }))
        await waitFor(() => expect(exportMock).toHaveBeenCalledWith(expect.objectContaining({ pixelRatio: 2, format: ExportFormat.PNG })))
        expect(exportMock.mock.calls[0][0].element).toHaveAttribute("data-document-theme", "ai")
    })

    it.each([
        { label: "PNG", format: ExportFormat.PNG },
        { label: "JPG", format: ExportFormat.JPG },
        { label: "WebP", format: ExportFormat.WebP },
    ])("saves, restores and downloads $label with the selected extension", async ({ label, format }) => {
        const user = userEvent.setup()
        const { unmount } = render(<MarkdownWorkspace />)
        await user.click(screen.getByRole("button", { name: label }))
        expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true")
        await waitFor(() => expect(loadDraft().draft?.settings.exportFormat).toBe(format))
        unmount()
        render(<MarkdownWorkspace />)

        expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true")
        await user.click(screen.getByRole("button", { name: `导出 ${label}` }))
        await waitFor(() => expect(exportMock).toHaveBeenCalledWith(expect.objectContaining({ format })))
        expect(vi.mocked(HTMLAnchorElement.prototype.click).mock.contexts[0]).toHaveProperty("download", `我的草稿.${format}`)
        expect(toast.success).toHaveBeenCalledWith(`${label} 图片已生成，已开始下载`)

        await user.click(screen.getByRole("button", { name: "重置" }))
        expect(screen.getByRole("button", { name: "PNG" })).toHaveAttribute("aria-pressed", "true")
    })

    it("saves, restores and exports at 4x, then resets to 2x", async () => {
        const user = userEvent.setup()
        const { unmount } = render(<MarkdownWorkspace />)

        await user.click(screen.getByRole("button", { name: "4×" }))
        expect(screen.getByRole("button", { name: "4×" })).toHaveAttribute("aria-pressed", "true")
        await waitFor(() => expect(loadDraft().draft?.settings.pixelRatio).toBe(4))
        unmount()
        render(<MarkdownWorkspace />)

        expect(screen.getByRole("button", { name: "4×" })).toHaveAttribute("aria-pressed", "true")
        await user.click(screen.getByRole("button", { name: "导出 PNG" }))
        await waitFor(() => expect(exportMock).toHaveBeenCalledWith(expect.objectContaining({ pixelRatio: 4 })))

        await user.click(screen.getByRole("button", { name: "排版设置" }))
        await user.click(screen.getByRole("button", { name: "重置" }))
        expect(screen.getByRole("button", { name: "2×" })).toHaveAttribute("aria-pressed", "true")
        await waitFor(() => expect(loadDraft().draft?.settings.pixelRatio).toBe(2))
    })

    it.each([ExportFormat.JPG, ExportFormat.WebP])("copies PNG at the selected scale while preserving the %s download setting", async format => {
        saveDraft({ draft: { source: savedSource, settings: { ...defaultSettings, pixelRatio: 4, exportFormat: format } } })
        const user = userEvent.setup()
        const write = vi.spyOn(navigator.clipboard, "write").mockImplementation(async items => void (await items[0].getType("image/png")))
        render(<MarkdownWorkspace />)

        const copyButton = screen.getByRole("button", { name: "复制图片" })
        copyButton.focus()
        await user.keyboard("{Enter}")

        await waitFor(() => expect(toast.success).toHaveBeenCalledWith("图片已复制，可以直接粘贴"))
        expect(write).toHaveBeenCalledOnce()
        expect(exportMock).toHaveBeenCalledWith(expect.objectContaining({ format: ExportFormat.PNG, pixelRatio: 4 }))
        expect(screen.getByRole("button", { name: `导出 ${exportFormats[format].label}` })).toBeEnabled()
        expect(loadDraft().draft?.settings.exportFormat).toBe(format)
        expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
    })

    it("locks both image actions until rendering and clipboard writing finish", async () => {
        const user = userEvent.setup()
        const image = Promise.withResolvers<Blob>()
        const clipboard = Promise.withResolvers<void>()
        exportMock.mockReturnValueOnce(image.promise)
        const write = vi.spyOn(navigator.clipboard, "write").mockReturnValue(clipboard.promise)
        render(<MarkdownWorkspace />)
        await user.click(screen.getByRole("button", { name: "排版设置" }))
        fireEvent.click(screen.getByRole("button", { name: "复制图片" }))

        expect(write).toHaveBeenCalledOnce()
        expect(screen.getByRole("button", { name: "正在复制…" })).toHaveAttribute("aria-busy", "true")
        expect(screen.getByRole("button", { name: "导出 PNG" })).toBeDisabled()
        expect(screen.getByRole("textbox", { name: "Markdown 正文" })).toBeDisabled()
        expect(screen.getByRole("spinbutton", { name: /画布宽度/ })).toBeDisabled()
        expect(screen.getByRole("button", { name: "编辑" })).toBeDisabled()
        expect(screen.getByRole("button", { name: "100%" })).toBeDisabled()
        for (const label of ["PNG", "JPG", "WebP"]) expect(screen.getByRole("button", { name: label })).toBeDisabled()

        fireEvent.click(screen.getByRole("button", { name: "导出 PNG" }))
        fireEvent.click(screen.getByRole("button", { name: "正在复制…" }))
        expect(exportMock).toHaveBeenCalledOnce()
        await act(() => image.resolve(new Blob(["PNG"], { type: "image/png" })))
        expect(screen.getByRole("textbox", { name: "Markdown 正文" })).toBeDisabled()
        expect(toast.success).not.toHaveBeenCalled()

        await act(() => clipboard.resolve())
        expect(screen.getByRole("button", { name: "复制图片" })).toBeEnabled()
        expect(screen.getByRole("button", { name: "导出 PNG" })).toBeEnabled()
        expect(screen.getByRole("textbox", { name: "Markdown 正文" })).toHaveValue(savedSource)
    })

    it("preserves content and allows retry after clipboard permission is denied", async () => {
        const user = userEvent.setup()

        vi.spyOn(navigator.clipboard, "write")
            .mockRejectedValueOnce(new DOMException("Permission denied", "NotAllowedError"))
            .mockImplementationOnce(async items => void (await items[0].getType("image/png")))

        render(<MarkdownWorkspace />)

        await user.click(screen.getByRole("button", { name: "复制图片" }))
        expect(await screen.findByText("图片暂未复制")).toBeInTheDocument()
        expect(screen.getByText(/浏览器未允许复制图片/)).toBeInTheDocument()
        expect(screen.getByRole("textbox", { name: "Markdown 正文" })).toHaveValue(savedSource)
        expect(toast.success).not.toHaveBeenCalled()

        await user.click(screen.getByRole("button", { name: "复制图片" }))
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith("图片已复制，可以直接粘贴"))
        expect(screen.queryByText("图片暂未复制")).not.toBeInTheDocument()
        expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
    })

    it("keeps ChatGPT references in the source while omitting them from the preview and export target", async () => {
        const user = userEvent.setup()
        const source = '正文:chatgpt-content-reference{index="0"}。'
        const { container } = render(<MarkdownWorkspace />)
        const editor = screen.getByRole("textbox", { name: "Markdown 正文" })

        fireEvent.change(editor, { target: { value: source } })
        expect(editor).toHaveValue(source)
        expect(container.querySelector(".markdown-document")?.textContent).toBe("正文。")

        await user.click(screen.getByRole("button", { name: "导出 PNG" }))

        await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1))
        expect(exportMock.mock.calls[0][0].element.textContent).toBe("正文。")
        expect(editor).toHaveValue(source)
    })

    it("does not export during Chinese composition and exports the committed text afterwards", async () => {
        const user = userEvent.setup()
        render(<MarkdownWorkspace />)
        const editor = screen.getByRole("textbox", { name: "Markdown 正文" })

        await user.click(editor)
        fireEvent.compositionStart(editor)
        fireEvent.change(editor, { target: { value: "正在输入中文" } })
        await user.keyboard("{Control>}{Enter}{/Control}")

        expect(exportMock).not.toHaveBeenCalled()
        expect(screen.getByRole("button", { name: "导出 PNG" })).toBeDisabled()
        expect(screen.getByRole("button", { name: "复制图片" })).toBeDisabled()
        expect(editor).toHaveValue("正在输入中文")

        fireEvent.compositionEnd(editor, { data: "中文" })
        await user.keyboard("{Control>}{Enter}{/Control}")

        await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1))
        expect(exportMock.mock.calls[0][0].element).toHaveTextContent("正在输入中文")
        expect(editor).toHaveValue("正在输入中文")
    })

    it("locks edits and view changes while exporting, then preserves content and allows retry after failure", async () => {
        const user = userEvent.setup()
        const pending = Promise.withResolvers<Blob>()
        exportMock.mockReturnValueOnce(pending.promise)
        render(<MarkdownWorkspace />)

        await user.click(screen.getByRole("button", { name: "排版设置" }))
        await user.click(screen.getByRole("button", { name: "导出 PNG" }))

        expect(screen.getByRole("textbox", { name: "Markdown 正文" })).toBeDisabled()
        expect(screen.getByRole("spinbutton", { name: /画布宽度/ })).toBeDisabled()
        expect(screen.getByRole("radio", { name: /纸张/ })).toHaveAttribute("aria-disabled", "true")
        expect(screen.getByRole("button", { name: "编辑" })).toBeDisabled()
        expect(screen.getByRole("button", { name: "预览" })).toBeDisabled()
        expect(screen.getByRole("button", { name: "100%" })).toBeDisabled()
        expect(screen.getByRole("button", { name: "清空" })).toBeDisabled()
        expect(screen.getByRole("button", { name: "复制图片" })).toBeDisabled()
        for (const label of ["PNG", "JPG", "WebP"]) expect(screen.getByRole("button", { name: label })).toBeDisabled()

        await act(() => pending.reject(new Error("图片跨域加载失败")))
        expect(await screen.findByText("图片跨域加载失败")).toBeInTheDocument()
        expect(screen.getByRole("textbox", { name: "Markdown 正文" })).toHaveValue(savedSource)

        await user.click(screen.getByRole("button", { name: "导出 PNG" }))
        await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(2))
        expect(screen.queryByText("图片跨域加载失败")).not.toBeInTheDocument()
        expect(screen.getByRole("button", { name: "编辑" })).toBeEnabled()
    })

    it("restores the draft and lets an intentional clear be undone and saved", async () => {
        saveDraft({ draft: { source: savedSource, settings: { ...defaultSettings, theme: MarkdownTheme.简约 } } })
        const user = userEvent.setup()
        render(<MarkdownWorkspace />)
        const editor = screen.getByRole("textbox", { name: "Markdown 正文" })

        expect(editor).toHaveValue(savedSource)
        expect(screen.getByRole("radio", { name: /简约/ })).toHaveAttribute("aria-checked", "true")
        expect(screen.getByRole("status")).toHaveTextContent("已恢复本地草稿")
        await user.click(screen.getByRole("button", { name: "清空" }))
        expect(editor).toHaveValue("")
        expect(screen.getByRole("button", { name: "导出 PNG" })).toBeDisabled()
        expect(screen.getByRole("button", { name: "复制图片" })).toBeDisabled()
        await waitFor(() => expect(loadDraft().draft?.source).toBe(""))

        await user.click(screen.getByRole("button", { name: "撤销替换" }))
        expect(editor).toHaveValue(savedSource)
        expect(screen.getByRole("button", { name: "撤销替换" })).toBeDisabled()
        await waitFor(() => expect(loadDraft().draft?.source).toBe(savedSource))
    })

    it("keeps the existing document after a decode failure and retries the same file using GB18030", async () => {
        const user = userEvent.setup()
        render(<MarkdownWorkspace />)
        const file = new File([new Uint8Array([0xd6, 0xd0, 0xce, 0xc4])], "中文.md")

        await user.upload(screen.getByLabelText("导入 Markdown 文件"), file)
        expect(await screen.findByText("文件未导入，原内容已保留")).toBeInTheDocument()
        expect(screen.getByRole("textbox", { name: "Markdown 正文" })).toHaveValue(savedSource)

        await user.click(screen.getByRole("combobox", { name: "文件编码" }))
        await user.click(await screen.findByRole("option", { name: "GB18030 / GBK" }))
        await user.click(screen.getByRole("button", { name: "重新导入" }))

        await waitFor(() => expect(screen.getByRole("textbox", { name: "Markdown 正文" })).toHaveValue("中文"))
        expect(screen.queryByText("文件未导入，原内容已保留")).not.toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: "撤销替换" }))
        expect(screen.getByRole("textbox", { name: "Markdown 正文" })).toHaveValue(savedSource)
    })

    it("allows replacing a numeric value in full before committing it on blur", async () => {
        const user = userEvent.setup()
        render(<MarkdownWorkspace />)
        await user.click(screen.getByRole("button", { name: "排版设置" }))
        const width = screen.getByRole("spinbutton", { name: /画布宽度/ })

        await user.click(width)
        await user.keyboard("{Control>}a{/Control}1000")
        expect(width).toHaveValue(1000)
        await user.tab()

        await waitFor(() => expect(loadDraft().draft?.settings.width).toBe(1000))
        expect(width).toHaveValue(1000)
        expect(screen.queryByText(/已保留原值/)).not.toBeInTheDocument()
    })
})
