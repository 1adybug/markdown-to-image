import { useEffect, useRef, useState } from "react"

import { cn } from "cn"
import {
    ArrowDownToLineIcon,
    CheckIcon,
    ChevronDownIcon,
    FileTextIcon,
    FolderOpenIcon,
    HelpCircleIcon,
    LoaderCircleIcon,
    MoonIcon,
    RotateCcwIcon,
    ShieldCheckIcon,
    SparklesIcon,
    SunIcon,
    Trash2Icon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "react-hot-toast"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import { DocumentPreview } from "./DocumentPreview"
import { loadDraft, saveDraft } from "./draft"
import { exportDocument } from "./export"
import { type MarkdownEncoding, countGraphemes, readMarkdownFile } from "./import-markdown"
import { type MarkdownDraft, defaultSettings, exampleMarkdown } from "./model"
import { ThemePicker, WorkspaceSettings } from "./WorkspaceSettings"

import "./workspace.css"

const encodings = [
    { value: "utf-8", label: "UTF-8" },
    { value: "gb18030", label: "GB18030 / GBK" },
]

export function MarkdownWorkspace() {
    const [initial] = useState(loadDraft)
    const [draft, setDraft] = useState<MarkdownDraft>(() => initial.draft ?? { source: exampleMarkdown, settings: { ...defaultSettings } })
    const [hasEdited, setHasEdited] = useState(false)
    const [saveError, setSaveError] = useState(initial.error)
    const [saveStatus, setSaveStatus] = useState(initial.draft ? "已恢复本地草稿" : "内容仅保存在此浏览器")
    const [previousSource, setPreviousSource] = useState<string | null>(null)
    const [isComposing, setIsComposing] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [exportError, setExportError] = useState<string | null>(null)
    const [importError, setImportError] = useState<string | null>(null)
    const [importFile, setImportFile] = useState<File | null>(null)
    const [encoding, setEncoding] = useState<MarkdownEncoding>("utf-8")
    const [mobileView, setMobileView] = useState("editor")
    const fileInputRef = useRef<HTMLInputElement>(null)
    const documentRef = useRef<HTMLDivElement>(null)
    const exportLock = useRef(false)
    const { resolvedTheme, setTheme } = useTheme()
    const busy = isExporting || isImporting

    function updateDraft(value: MarkdownDraft) {
        setDraft(value)
        setHasEdited(true)
        setSaveStatus("正在保存本地草稿…")
    }

    function replaceSource(source: string) {
        setPreviousSource(draft.source)
        updateDraft({ ...draft, source })
    }

    useEffect(() => {
        if (!hasEdited || isComposing) return

        const timeout = setTimeout(() => {
            const { error } = saveDraft({ draft })
            setSaveError(error)
            setSaveStatus(error ? "草稿尚未保存" : "已保存到此浏览器")
        }, 400)

        return () => clearTimeout(timeout)
    }, [draft, hasEdited, isComposing])

    useEffect(() => {
        if (!hasEdited) return

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (isComposing || saveDraft({ draft }).error) event.preventDefault()
        }

        window.addEventListener("beforeunload", handleBeforeUnload)
        return () => window.removeEventListener("beforeunload", handleBeforeUnload)
    }, [draft, hasEdited, isComposing])

    async function handleImport(file: File, selectedEncoding: MarkdownEncoding) {
        setImportFile(file)
        setIsImporting(true)
        setImportError(null)

        try {
            const source = await readMarkdownFile({ file, encoding: selectedEncoding })
            replaceSource(source)
            setImportFile(null)
            toast.success(`已导入 ${file.name}`)
        } catch (error) {
            setImportError(error instanceof Error ? error.message : "文件读取失败，请重试。")
        } finally {
            setIsImporting(false)
        }
    }

    async function handleExport() {
        if (exportLock.current || busy || isComposing || !draft.source.trim() || !documentRef.current) return
        exportLock.current = true
        setIsExporting(true)
        setMobileView("preview")
        setExportError(null)

        try {
            const blob = await exportDocument({ element: documentRef.current, pixelRatio: draft.settings.pixelRatio })
            const title = draft.source.match(/^#\s+(.+)$/m)?.[1] ?? "Markdown 图片"

            const safeTitle = Array.from(title.replace(/[<>:"/\\|?*]/g, ""))
                .filter(character => character.codePointAt(0)! >= 32)
                .join("")
                .trim()

            const filename =
                Array.from(new Intl.Segmenter("zh-CN", { granularity: "grapheme" }).segment(safeTitle))
                    .slice(0, 60)
                    .map(item => item.segment)
                    .join("") || "Markdown 图片"
            const url = URL.createObjectURL(blob)
            const anchor = document.createElement("a")
            anchor.href = url
            anchor.download = `${filename}.png`
            anchor.click()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
            toast.success("PNG 图片已生成，已开始下载")
        } catch (error) {
            setExportError(error instanceof Error ? error.message : "导出失败，请重试。")
        } finally {
            exportLock.current = false
            setIsExporting(false)
        }
    }

    return (
        <main className="markdown-workspace" lang="zh-CN">
            <title>Markdown 转图片 · 字里成图</title>
            <header className="workspace-header">
                <div className="workspace-brand">
                    <span className="brand-mark" aria-hidden="true">
                        文<span />
                    </span>
                    <div>
                        <h1>字里成图</h1>
                        <p>Markdown 转图片</p>
                    </div>
                </div>
                <div className="header-actions">
                    <span className="privacy-note">
                        <ShieldCheckIcon aria-hidden="true" />
                        本地处理，无需登录
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={isExporting}
                        aria-label={resolvedTheme === "dark" ? "切换浅色界面" : "切换深色界面"}
                        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                    >
                        {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
                    </Button>
                    <Button
                        className="export-button"
                        size="lg"
                        disabled={busy || isComposing || !draft.source.trim()}
                        aria-busy={isExporting}
                        onClick={handleExport}
                    >
                        {isExporting ? (
                            <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
                        ) : (
                            <ArrowDownToLineIcon data-icon="inline-start" />
                        )}
                        {isExporting ? "正在生成…" : "导出 PNG"}
                    </Button>
                </div>
            </header>
            <div className="workspace-body">
                <div className="workspace-intro">
                    <div>
                        <h2>好文字，值得好好呈现。</h2>
                        <p>写下想法，调好排版，带走一张清晰的图片。</p>
                    </div>
                    <span className="intro-note">为中文阅读，多想一点。</span>
                </div>
                {saveError && (
                    <Alert variant="destructive">
                        <AlertTitle>本地草稿未保存</AlertTitle>
                        <AlertDescription>
                            {saveError} 当前编辑内容仍然保留，请暂时不要关闭页面。
                            <Button
                                variant="link"
                                onClick={() => {
                                    const { error } = saveDraft({ draft })
                                    setSaveError(error)

                                    if (!error) setSaveStatus("已保存到此浏览器")
                                }}
                            >
                                重试保存
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
                {exportError && (
                    <Alert variant="destructive">
                        <AlertTitle>图片暂未导出</AlertTitle>
                        <AlertDescription>{exportError}</AlertDescription>
                    </Alert>
                )}
                <ThemePicker data={draft.settings} disabled={busy} onChange={settings => updateDraft({ ...draft, settings })} />
                <WorkspaceSettings data={draft.settings} disabled={busy} onChange={settings => updateDraft({ ...draft, settings })} />
                <div className="mobile-view-switch">
                    <ToggleGroup
                        value={[mobileView]}
                        disabled={isExporting}
                        onValueChange={values => {
                            if (values[0]) setMobileView(values[0])
                        }}
                        aria-label="工作区视图"
                        variant="outline"
                        spacing={0}
                    >
                        <ToggleGroupItem value="editor">编辑</ToggleGroupItem>
                        <ToggleGroupItem value="preview">预览</ToggleGroupItem>
                    </ToggleGroup>
                </div>
                <div className="workspace-panels" data-mobile-view={mobileView}>
                    <section className="editor-panel" aria-labelledby="editor-heading">
                        <header className="panel-heading">
                            <div>
                                <FileTextIcon aria-hidden="true" />
                                <h2 id="editor-heading">Markdown</h2>
                            </div>
                            <div className="editor-actions">
                                <Button variant="ghost" size="sm" disabled={busy || isComposing} onClick={() => replaceSource(exampleMarkdown)}>
                                    <SparklesIcon data-icon="inline-start" />
                                    示例
                                </Button>
                                <Button variant="ghost" size="sm" disabled={busy || isComposing} onClick={() => fileInputRef.current?.click()}>
                                    <FolderOpenIcon data-icon="inline-start" />
                                    导入
                                </Button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="sr-only"
                                    tabIndex={-1}
                                    accept=".md,.markdown,.txt"
                                    aria-label="导入 Markdown 文件"
                                    disabled={busy || isComposing}
                                    onChange={event => {
                                        const file = event.currentTarget.files?.[0]
                                        event.currentTarget.value = ""
                                        if (file) void handleImport(file, encoding)
                                    }}
                                />
                            </div>
                        </header>
                        {importError && (
                            <Alert variant="destructive" className="import-feedback">
                                <AlertTitle>文件未导入，原内容已保留</AlertTitle>
                                <AlertDescription>{importError}</AlertDescription>
                                <div className="import-retry">
                                    <Select
                                        value={encoding}
                                        items={encodings}
                                        onValueChange={value => {
                                            if (value === "utf-8" || value === "gb18030") setEncoding(value)
                                        }}
                                        disabled={busy}
                                    >
                                        <SelectTrigger className="w-44" aria-label="文件编码">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent alignItemWithTrigger={false}>
                                            <SelectGroup>
                                                {encodings.map(item => (
                                                    <SelectItem value={item.value} key={item.value}>
                                                        {item.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={!importFile || busy}
                                        onClick={() => {
                                            if (importFile) void handleImport(importFile, encoding)
                                        }}
                                    >
                                        重新导入
                                    </Button>
                                </div>
                            </Alert>
                        )}
                        <Field className="editor-field">
                            <FieldLabel className="sr-only" htmlFor="markdown-source">
                                Markdown 正文
                            </FieldLabel>
                            <Textarea
                                id="markdown-source"
                                variant="editor"
                                className="markdown-editor"
                                value={draft.source}
                                spellCheck={false}
                                disabled={busy}
                                placeholder={"在这里写下你的第一句话…\n\n# 标题\n这是**“中文加粗”**的示例。"}
                                onChange={event => updateDraft({ ...draft, source: event.currentTarget.value })}
                                onCompositionStart={() => setIsComposing(true)}
                                onCompositionEnd={() => setIsComposing(false)}
                                onKeyDown={event => {
                                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.nativeEvent.isComposing && !isComposing) {
                                        event.preventDefault()
                                        void handleExport()
                                    }
                                }}
                            />
                        </Field>
                        <footer className="panel-footer">
                            <span>{countGraphemes(draft.source).toLocaleString("zh-CN")} 字符</span>
                            <div className="editor-footer-actions">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={previousSource === null || busy || isComposing}
                                    onClick={() => {
                                        if (previousSource !== null) {
                                            updateDraft({ ...draft, source: previousSource })
                                            setPreviousSource(null)
                                        }
                                    }}
                                >
                                    <RotateCcwIcon data-icon="inline-start" />
                                    撤销替换
                                </Button>
                                <Button variant="ghost" size="sm" disabled={!draft.source || busy || isComposing} onClick={() => replaceSource("")}>
                                    <Trash2Icon data-icon="inline-start" />
                                    清空
                                </Button>
                            </div>
                        </footer>
                    </section>
                    <DocumentPreview data={draft} documentRef={documentRef} disabled={isExporting} />
                </div>
                <footer className="workspace-status">
                    <span className={cn("save-status", saveError && "text-destructive")} role="status">
                        <CheckIcon aria-hidden="true" />
                        {isComposing ? "正在输入…" : saveStatus}
                    </span>
                    <span>PNG · 无水印 · Ctrl / ⌘ + Enter 导出</span>
                </footer>
                <Collapsible className="writing-help">
                    <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
                        <HelpCircleIcon data-icon="inline-start" />
                        中文 Markdown 小贴士
                        <ChevronDownIcon data-icon="inline-end" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <div className="writing-help-content">
                            <p>支持中文标点旁的粗体、斜体和删除线。空行表示新段落；“保留单次换行”可控制普通回车的显示。</p>
                            <p>Markdown 使用半角标记，例如 # 和 *；全角 ＃、＊ 会保留为正文。URL 紧贴中文标点时，建议使用 [链接文字](网址)。</p>
                            <p>
                                图片需使用可访问且允许跨域的地址；本地 Markdown
                                中的相对图片路径不会自动上传。正文只保存在此浏览器，图片地址仍会由浏览器访问。导入支持 .md、.markdown、.txt，最大 2 MB。
                            </p>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </div>
        </main>
    )
}
