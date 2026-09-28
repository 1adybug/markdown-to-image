import { type DocumentSettings, type MarkdownDraft, isPixelRatio, MarkdownTheme, settingRanges } from "./model"

export const DRAFT_STORAGE_KEY = "markdown-to-image:draft"

const draftVersion = 1
const themeValues = new Set<string>(Object.values(MarkdownTheme))

interface SettingNumberRange {
    min: number
    max: number
}

export interface LoadDraftResult {
    draft: MarkdownDraft | null
    error: string | null
}

export interface SaveDraftResult {
    error: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isSettingNumber(value: unknown, range: SettingNumberRange): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= range.min && value <= range.max
}

function parseDraft(value: unknown): MarkdownDraft | null {
    if (!isRecord(value) || typeof value.source !== "string" || !isRecord(value.settings)) return null

    const settings = value.settings

    if (
        typeof settings.theme !== "string" ||
        !themeValues.has(settings.theme) ||
        !isSettingNumber(settings.width, settingRanges.width) ||
        !isSettingNumber(settings.fontSize, settingRanges.fontSize) ||
        !isSettingNumber(settings.lineHeight, settingRanges.lineHeight) ||
        !isSettingNumber(settings.padding, settingRanges.padding) ||
        typeof settings.preserveLineBreaks !== "boolean" ||
        !isPixelRatio(settings.pixelRatio)
    )
        return null

    // Only persist the document model, never derived HTML or unknown payload fields.
    const parsedSettings: DocumentSettings = {
        theme: settings.theme as MarkdownTheme,
        width: settings.width,
        fontSize: settings.fontSize,
        lineHeight: settings.lineHeight,
        padding: settings.padding,
        preserveLineBreaks: settings.preserveLineBreaks,
        pixelRatio: settings.pixelRatio,
    }

    return { source: value.source, settings: parsedSettings }
}

export function loadDraft(): LoadDraftResult {
    let raw: string | null

    try {
        raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    } catch {
        return { draft: null, error: "无法读取本地草稿，请检查浏览器的存储权限。当前内容仍可编辑和导出。" }
    }

    if (raw === null) return { draft: null, error: null }

    try {
        const payload: unknown = JSON.parse(raw)

        if (!isRecord(payload) || payload.version !== draftVersion) return { draft: null, error: "本地草稿版本不兼容，未恢复该草稿。" }

        const draft = parseDraft(payload.draft)

        if (!draft) return { draft: null, error: "本地草稿格式不正确，未恢复该草稿。" }

        return { draft, error: null }
    } catch {
        return { draft: null, error: "本地草稿已损坏，未恢复该草稿。" }
    }
}

export interface SaveDraftParams {
    draft: MarkdownDraft
}

export function saveDraft(params: SaveDraftParams): SaveDraftResult {
    const parsedDraft = parseDraft(params.draft)

    if (!parsedDraft) return { error: "草稿设置无效，未保存。当前内容仍保留在编辑器中。" }

    try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ version: draftVersion, draft: parsedDraft }))
        return { error: null }
    } catch {
        return { error: "本地草稿保存失败，可能是存储空间不足或权限受限。当前内容仍可编辑和导出，关闭前请备份原文。" }
    }
}
