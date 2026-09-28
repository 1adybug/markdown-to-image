import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { loadDraft, saveDraft } from "./draft"
import { exportDocument } from "./export"
import { MarkdownWorkspace } from "./MarkdownWorkspace"
import { defaultSettings } from "./model"

vi.mock("./export", () => ({ exportDocument: vi.fn() }))
vi.mock("react-hot-toast", () => ({ toast: { success: vi.fn() } }))
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }) }))

const savedSource = "# 我的草稿\n\n保留这段中文。"
const exportMock = vi.mocked(exportDocument)

beforeEach(() => {
    localStorage.clear()
    saveDraft({ draft: { source: savedSource, settings: { ...defaultSettings } } })
    exportMock.mockReset().mockResolvedValue(new Blob(["PNG"], { type: "image/png" }))

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
    it("defaults to 2x when there is no saved draft", async () => {
        localStorage.clear()
        const user = userEvent.setup()
        render(<MarkdownWorkspace />)

        expect(screen.getByRole("button", { name: "2×" })).toHaveAttribute("aria-pressed", "true")
        await user.click(screen.getByRole("button", { name: "导出 PNG" }))
        await waitFor(() => expect(exportMock).toHaveBeenCalledWith(expect.objectContaining({ pixelRatio: 2 })))
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

        await act(() => pending.reject(new Error("图片跨域加载失败")))
        expect(await screen.findByText("图片跨域加载失败")).toBeInTheDocument()
        expect(screen.getByRole("textbox", { name: "Markdown 正文" })).toHaveValue(savedSource)

        await user.click(screen.getByRole("button", { name: "导出 PNG" }))
        await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(2))
        expect(screen.queryByText("图片跨域加载失败")).not.toBeInTheDocument()
        expect(screen.getByRole("button", { name: "编辑" })).toBeEnabled()
    })

    it("restores the draft and lets an intentional clear be undone and saved", async () => {
        const user = userEvent.setup()
        render(<MarkdownWorkspace />)
        const editor = screen.getByRole("textbox", { name: "Markdown 正文" })

        expect(editor).toHaveValue(savedSource)
        expect(screen.getByRole("status")).toHaveTextContent("已恢复本地草稿")
        await user.click(screen.getByRole("button", { name: "清空" }))
        expect(editor).toHaveValue("")
        expect(screen.getByRole("button", { name: "导出 PNG" })).toBeDisabled()
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
