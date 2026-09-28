import { Fragment } from "react"

import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { MarkdownDocument } from "./MarkdownDocument"
import { defaultSettings, MarkdownTheme } from "./model"

function renderMarkdown(source: string, preserveLineBreaks = true) {
    return render(<MarkdownDocument data={{ source, settings: { ...defaultSettings, preserveLineBreaks } }} />)
}

describe("中文 Markdown 语法", () => {
    it.each([
        ["这是**“值得被看见的想法”**，也是日常。", "“值得被看见的想法”"],
        ["记住**这一点：**好的排版，让阅读更轻松。", "这一点："],
        ["这是**（认真记录的日常）**也很重要。", "（认真记录的日常）"],
        ["**中文句号。**接着写中文。", "中文句号。"],
        ["繁體**「標點與強調」**也應正確。", "「標點與強調」"],
        ["这是**《书名》**的例子。", "《书名》"],
        ["这是**【重点】**的例子。", "【重点】"],
        ["这是**你好！**的例子。", "你好！"],
    ])("解析中文标点相邻强调：%s", (source, expected) => {
        const { container } = renderMarkdown(source)
        expect(container.querySelector("strong")?.textContent).toBe(expected)
        expect(container.textContent).not.toContain("**")
    })

    it("保留斜体、删除线、嵌套强调与链接内强调", () => {
        const { container } = renderMarkdown("这是*「灵感」*也是~~（旧想法）~~。这是**外层*内层*结尾**。\n[**「链接」**](https://example.com/中文?词=繁體)")
        expect(container.querySelector("em")?.textContent).toBe("「灵感」")
        expect(container.querySelector("del")?.textContent).toBe("（旧想法）")
        expect(container.querySelector("strong em")?.textContent).toBe("内层")
        const link = container.querySelector("a")
        expect(link?.querySelector("strong")?.textContent).toBe("「链接」")
        expect(link?.getAttribute("href")).toContain("example.com/")
        expect(decodeURI(link?.getAttribute("href") ?? "")).toBe("https://example.com/中文?词=繁體")
    })

    it("不改变转义、行内代码、围栏代码和词内下划线", () => {
        const { container } = renderMarkdown("\\*\\*中文。\\*\\* `**中文。**` snake_case foo__bar__baz\n\n```text\n**中文。**\n```\n\n_斜体_ __强调__")
        expect(container.querySelector("p")?.textContent).toBe("**中文。** **中文。** snake_case foo__bar__baz")
        expect([...container.querySelectorAll("code")].map(node => node.textContent)).toEqual(["**中文。**", "**中文。**\n"])
        expect(container.querySelectorAll("strong")).toHaveLength(1)
        expect(container.querySelectorAll("em")).toHaveLength(1)
    })

    it("不自动转换全角标记、简繁体、生僻字或 Emoji", () => {
        const source = "＃ 全角标题\n＊全角星号＊\n简体 繁體 𠮷 👨‍👩‍👧‍👦"
        const { container } = renderMarkdown(source)
        expect(container.querySelector("h1")).toBeNull()
        expect(container.querySelector("em")).toBeNull()
        expect(container.textContent).toContain("简体 繁體 𠮷 👨‍👩‍👧‍👦")
    })

    it.each(["\n", "\r\n"])("默认保留单次换行并保留段落：%j", newline => {
        const { container } = renderMarkdown(["第一行", "第二行", "", "第三段"].join(newline))
        expect(container.querySelectorAll("p")).toHaveLength(2)
        expect(container.querySelectorAll("br")).toHaveLength(1)
    })

    it("标准段落模式仍保留显式硬换行", () => {
        const { container } = renderMarkdown("第一行\n第二行  \n第三行\n\n第二段", false)
        expect(container.querySelectorAll("p")).toHaveLength(2)
        expect(container.querySelectorAll("br")).toHaveLength(1)
        expect(container.querySelector("p")?.textContent).toContain("第一行\n第二行")
    })

    it("保留 GFM 表格对齐、嵌套列表、编号起点和只读任务状态", () => {
        const { container } = renderMarkdown(
            "| 左 | 中 | 右 |\n| :--- | :---: | ---: |\n| 中文 | 繁體 | English |\n\n3. 第三项\n4. 第四项\n   - 嵌套项\n\n- [x] 完成\n- [ ] 待办",
        )
        expect(container.querySelectorAll("th")).toHaveLength(3)
        expect(container.querySelectorAll("th")[1].style.textAlign).toBe("center")
        expect(container.querySelectorAll("td")[2].style.textAlign).toBe("right")
        expect(container.querySelector("ol")?.getAttribute("start")).toBe("3")
        expect(container.querySelector("ol li ul li")?.textContent).toBe("嵌套项")
        expect(screen.getByRole("checkbox", { name: "已完成" }).getAttribute("aria-checked")).toBe("true")
        expect(screen.getByRole("checkbox", { name: "未完成" }).getAttribute("aria-disabled")).toBe("true")
    })

    it("脚注使用中文标签并能往返跳转，多个文稿的标识互不冲突", () => {
        const source = "正文[^注]\n\n[^注]: 这是注释。"

        const { container } = render(
            <Fragment>
                <MarkdownDocument data={{ source, settings: defaultSettings }} />
                <MarkdownDocument data={{ source, settings: defaultSettings }} />
            </Fragment>,
        )

        const documents = container.querySelectorAll(".markdown-document")
        const ids = [...container.querySelectorAll("[id]")].map(node => node.id)
        expect(new Set(ids).size).toBe(ids.length)

        for (const document of documents) {
            expect(document.querySelector(".footnotes h2")?.textContent).toBe("注释")

            for (const link of document.querySelectorAll('a[href^="#"]')) {
                const id = link.getAttribute("href")?.slice(1)
                expect([...document.querySelectorAll("[id]")].some(node => node.id === id)).toBe(true)
            }

            expect(document.querySelector('[aria-label="返回引用 1"]')).not.toBeNull()
        }
    })

    it("高亮中文注释代码，未知语言和普通文本不报错", () => {
        const { container } = renderMarkdown('```typescript\nconst hello = "中文" // 注释\n```\n\n```unknown-language\n安全的原文\n```')
        expect(container.querySelector(".hljs-keyword")?.textContent).toBe("const")
        expect(container.querySelector(".hljs-comment")?.textContent).toBe("// 注释")
        expect(container.textContent).toContain("安全的原文")
    })
})

describe("安全内容与图片", () => {
    it("保留安全 HTML，过滤执行内容、事件、样式和危险协议", () => {
        const { container } = renderMarkdown(
            '<b>粗体</b><br><img src="javascript:alert(1)" onerror="alert(2)"><script>alert(3)</script><style>body{display:none}</style><iframe src="https://example.com"></iframe>\n\n<a href="javascript:alert(4)" style="position:fixed">危险链接</a>\n\n[危险](javascript:alert%285%29)',
        )
        expect(container.querySelector("b")?.textContent).toBe("粗体")
        expect(container.querySelector("br")).not.toBeNull()
        expect(container.querySelector("script, style, iframe, [onerror], a[style]")).toBeNull()
        expect([...container.querySelectorAll("a")].every(node => !node.getAttribute("href"))).toBe(true)
        expect(container.textContent).not.toContain("alert(3)")
        expect(container.querySelector('[data-image-error="true"]')).not.toBeNull()
    })

    it("只允许栅格 data 图片，不执行 SVG data 图片", () => {
        const { container } = renderMarkdown('![像素](data:image/png;base64,aGVsbG8=)\n\n<img alt="拒绝" src="data:image/svg+xml;base64,aGVsbG8=">')
        expect(container.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,aGVsbG8=")
        expect(container.querySelectorAll("img")).toHaveLength(1)
        expect(container.querySelector("[data-image-error]")?.textContent).toContain("拒绝")
    })

    it("跨域图片使用匿名请求，错误可见且修改地址可重试", () => {
        const { container, rerender } = renderMarkdown("![示意](https://example.com/image.png)")
        const image = screen.getByAltText("示意")
        expect(image.getAttribute("crossorigin")).toBe("anonymous")
        fireEvent.error(image)
        expect(container.querySelector("[data-image-error]")?.textContent).toContain("图片无法加载：示意")
        rerender(<MarkdownDocument data={{ source: "![新图片](https://example.com/new.png)", settings: defaultSettings }} />)
        expect(container.querySelector("[data-image-error]")).toBeNull()
        expect(screen.getByAltText("新图片")).toBeDefined()
    })

    it("同一图片地址可以重试，重新加载成功前保留导出阻止标记", () => {
        const { container } = renderMarkdown("![示意](https://example.com/image.png)")
        const initialImage = screen.getByAltText("示意")
        fireEvent.error(initialImage)
        fireEvent.click(screen.getByRole("button", { name: "重新加载图片" }))

        const retryImage = screen.getByAltText("示意")
        expect(retryImage).not.toBe(initialImage)
        expect(retryImage).toHaveAttribute("src", "https://example.com/image.png")
        expect(retryImage).toHaveAttribute("hidden")
        expect(screen.getByRole("button", { name: "重新加载图片" })).toBeDisabled()
        expect(container.querySelector('[data-image-error="true"]')).not.toBeNull()

        fireEvent.load(retryImage)
        expect(retryImage).not.toHaveAttribute("hidden")
        expect(container.querySelector("[data-image-error]")).toBeNull()
        expect(screen.queryByRole("button", { name: "重新加载图片" })).toBeNull()
    })

    it("图片重试失败后可再次重试，不修改原地址", () => {
        const { container } = renderMarkdown("![示意](https://example.com/image.png)")
        fireEvent.error(screen.getByAltText("示意"))
        fireEvent.click(screen.getByRole("button", { name: "重新加载图片" }))
        fireEvent.error(screen.getByAltText("示意"))

        expect(container.querySelector('[data-image-error="true"]')).not.toBeNull()
        expect(screen.getByRole("button", { name: "重新加载图片" })).toBeEnabled()
        expect(screen.getByAltText("示意")).toHaveAttribute("src", "https://example.com/image.png")
    })

    it("图片重试超时后恢复重试按钮，并继续阻止缺图导出", () => {
        vi.useFakeTimers()

        try {
            const { container } = renderMarkdown("![示意](https://example.com/image.png)")
            fireEvent.error(screen.getByAltText("示意"))
            fireEvent.click(screen.getByRole("button", { name: "重新加载图片" }))
            act(() => vi.advanceTimersByTime(20_000))
            expect(screen.getByRole("button", { name: "重新加载图片" })).toBeEnabled()
            expect(container.querySelector('[data-image-error="true"]')).not.toBeNull()
        } finally {
            vi.useRealTimers()
        }
    })
})

describe("文稿输出契约", () =>
    void it.each(Object.values(MarkdownTheme))("主题 %s 使用同一文稿和明确的输出尺寸", theme => {
        const { container } = render(
            <MarkdownDocument data={{ source: "# 中文标题\n\n正文", settings: { ...defaultSettings, theme, width: 480, padding: 32 } }} />,
        )
        const document = container.querySelector<HTMLElement>(".markdown-document")
        expect(document?.getAttribute("data-document-theme")).toBe(theme)
        expect(document?.lang).toBe("zh-CN")
        expect(document?.style.width).toBe("480px")
        expect(document?.style.padding).toBe("32px")
        expect(document?.style.boxSizing).toBe("border-box")
        expect(document?.querySelector("h1")?.textContent).toBe("中文标题")
    }))
