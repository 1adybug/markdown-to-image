import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DRAFT_STORAGE_KEY, loadDraft, saveDraft } from "./draft"
import { type MarkdownDraft, defaultSettings, MarkdownTheme } from "./model"

const draft: MarkdownDraft = {
    source: "# 草稿\r\n\r\n**（中文）**與繁體 👨‍👩‍👧‍👦",
    settings: { ...defaultSettings },
}

let stored: Map<string, string>

beforeEach(() => {
    stored = new Map()

    vi.stubGlobal("localStorage", {
        getItem: vi.fn((key: string) => stored.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => void stored.set(key, value)),
    })
})

afterEach(() => void vi.unstubAllGlobals())

describe("local Markdown draft", () => {
    it("distinguishes no stored draft from an intentionally empty document", () => {
        expect(loadDraft()).toEqual({ draft: null, error: null })
        expect(saveDraft({ draft: { ...draft, source: "" } })).toEqual({ error: null })
        expect(loadDraft()).toEqual({ draft: { ...draft, source: "" }, error: null })
    })

    it.each(Object.values(MarkdownTheme))("round-trips source and settings for %s", theme => {
        const value = { ...draft, settings: { ...defaultSettings, theme, preserveLineBreaks: false, pixelRatio: 3 as const } }

        expect(saveDraft({ draft: value })).toEqual({ error: null })
        expect(loadDraft()).toEqual({ draft: value, error: null })
    })

    it.each([1, 2, 3, 4] as const)("round-trips the %sx export setting", pixelRatio => {
        const value = { ...draft, settings: { ...defaultSettings, pixelRatio } }

        expect(saveDraft({ draft: value })).toEqual({ error: null })
        expect(loadDraft()).toEqual({ draft: value, error: null })
    })

    it("only stores versioned source and settings, excluding derived or unknown fields", () => {
        const value = { ...draft, html: "<script>bad()</script>", settings: { ...draft.settings, unknown: true } }

        saveDraft({ draft: value })
        expect(JSON.parse(stored.get(DRAFT_STORAGE_KEY)!)).toEqual({ version: 1, draft })
    })

    it.each(["not JSON", "null", "[]", JSON.stringify({ version: 2, draft }), JSON.stringify({ version: 1, draft: null })])(
        "reports unusable stored data without deleting it: %s",
        value => {
            stored.set(DRAFT_STORAGE_KEY, value)
            expect(loadDraft()).toEqual({ draft: null, error: expect.any(String) })
            expect(stored.get(DRAFT_STORAGE_KEY)).toBe(value)
        },
    )

    it.each([
        { theme: "unknown" },
        { width: 0 },
        { width: 1601 },
        { width: "720" },
        { fontSize: 11 },
        { lineHeight: 2.5 },
        { padding: 15 },
        { preserveLineBreaks: "true" },
        { pixelRatio: 1.5 },
        { pixelRatio: 0 },
        { pixelRatio: 5 },
        { pixelRatio: "2" },
        { width: null },
    ])("rejects invalid settings %j", settings => {
        stored.set(DRAFT_STORAGE_KEY, JSON.stringify({ version: 1, draft: { ...draft, settings: { ...draft.settings, ...settings } } }))
        expect(loadDraft()).toEqual({ draft: null, error: expect.any(String) })
    })

    it.each([NaN, Infinity, -Infinity])("rejects nonfinite values before serializing %s", width => {
        expect(saveDraft({ draft: { ...draft, settings: { ...draft.settings, width } } }).error).toBeTruthy()
        expect(stored.has(DRAFT_STORAGE_KEY)).toBe(false)
    })

    it("reports both read and write access failures", () => {
        vi.stubGlobal("localStorage", {
            getItem: () => {
                throw new DOMException("Access denied", "SecurityError")
            },
            setItem: () => {
                throw new DOMException("Quota exceeded", "QuotaExceededError")
            },
        })

        expect(loadDraft()).toEqual({ draft: null, error: expect.stringContaining("存储权限") })
        expect(saveDraft({ draft }).error).toContain("保存失败")
        expect(draft.source).toContain("中文")
    })
})
