import { type Ref, useEffect, useRef, useState } from "react"

import { ImageIcon, ScanIcon } from "lucide-react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import { MarkdownDocument } from "./MarkdownDocument"
import type { MarkdownDraft } from "./model"

export interface DocumentPreviewProps {
    data: MarkdownDraft
    documentRef: Ref<HTMLDivElement>
    disabled: boolean
}

export function DocumentPreview({ data, documentRef, disabled }: DocumentPreviewProps) {
    const viewportRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement | null>(null)
    const [viewportWidth, setViewportWidth] = useState(0)
    const [height, setHeight] = useState(0)
    const [zoom, setZoom] = useState("fit")
    const isEmpty = !data.source.trim()

    useEffect(() => {
        const viewport = viewportRef.current
        const content = contentRef.current?.firstElementChild as HTMLElement | null
        if (!viewport || !content) return

        const measure = () => {
            setViewportWidth(Math.max(0, viewport.clientWidth - 48))
            setHeight(Math.ceil(Math.max(Number.parseFloat(getComputedStyle(content).height) || 0, content.offsetHeight, content.scrollHeight)))
        }

        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(viewport)
        observer.observe(content)
        return () => observer.disconnect()
    }, [])

    const scale = zoom === "actual" || !viewportWidth ? 1 : Math.min(1, viewportWidth / data.settings.width)

    return (
        <section className="preview-panel" aria-labelledby="preview-heading">
            <header className="panel-heading">
                <div>
                    <ImageIcon aria-hidden="true" />
                    <h2 id="preview-heading">图片预览</h2>
                    <span className="live-label">
                        <i />
                        实时
                    </span>
                </div>
                <ToggleGroup
                    value={[zoom]}
                    onValueChange={values => {
                        if (values[0]) setZoom(values[0])
                    }}
                    disabled={disabled}
                    aria-label="预览缩放"
                    size="sm"
                >
                    <ToggleGroupItem value="fit" aria-label="适应宽度">
                        <ScanIcon data-icon="inline-start" />
                        <span>适应</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem value="actual">100%</ToggleGroupItem>
                </ToggleGroup>
            </header>
            <div className="preview-viewport" ref={viewportRef}>
                {isEmpty && (
                    <Empty>
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <ImageIcon />
                            </EmptyMedia>
                            <EmptyTitle>从一句话开始</EmptyTitle>
                            <EmptyDescription>在编辑区写下内容，图片会在这里呈现。</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}
                <div className="preview-paper-frame" hidden={isEmpty} style={{ width: data.settings.width * scale, height: height * scale }}>
                    <div className="preview-paper-scale" ref={contentRef} style={{ width: data.settings.width, transform: `scale(${scale})` }}>
                        <MarkdownDocument data={data} ref={documentRef} />
                    </div>
                </div>
            </div>
            <footer className="panel-footer">
                <span>预览 {Math.round(scale * 100)}% · 导出不受缩放影响</span>
                <span>
                    {data.settings.width * data.settings.pixelRatio} × {Math.ceil(height) * data.settings.pixelRatio} px
                </span>
            </footer>
        </section>
    )
}
