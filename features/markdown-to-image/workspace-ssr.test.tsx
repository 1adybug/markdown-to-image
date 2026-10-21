// @vitest-environment node

import { renderToString } from "react-dom/server"

import { describe, expect, it } from "vitest"

import Page from "@/app/page"

describe("workspace server rendering", () =>
    void it("renders the initial workspace without browser APIs or a deferred component", () => {
        const html = renderToString(<Page />)

        expect(html).toContain('class="markdown-workspace"')
        expect(html).toContain("字里成图")
        expect(html).toContain('id="markdown-source"')
        expect(html).toContain("图片预览")
        expect(html).toContain("正在恢复本地草稿…")
        expect(html).not.toContain("正在打开工作台")
        expect(html).not.toContain("无法读取本地草稿")
        expect(html).not.toContain("BAILOUT_TO_CLIENT_SIDE_RENDERING")
    }))
