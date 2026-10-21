import { type ComponentProps, type Ref, createContext, Fragment, memo, useContext, useEffect, useId, useMemo, useState } from "react"

import { cn } from "cn"
import ReactMarkdown, { type Components, type Options } from "react-markdown"

import { getImageUrl } from "./image-url"
import { documentUrlTransform, getRehypePlugins, getRemarkPlugins } from "./markdown-pipeline"
import type { MarkdownDraft } from "./model"

import "./document.css"

const AnchorPrefixContext = createContext("")

function DocumentLink({ href, children, title, id, ...rest }: ComponentProps<"a">) {
    const anchorPrefix = useContext(AnchorPrefixContext)
    const target = href?.startsWith("#") ? `#${anchorPrefix}${href.slice(1)}` : href
    return (
        <a
            id={id}
            href={target}
            title={title}
            target={target?.startsWith("#") ? undefined : "_blank"}
            rel="noreferrer noopener"
            aria-label={rest["aria-label"]}
            aria-describedby={rest["aria-describedby"]}
        >
            {children}
        </a>
    )
}

function ImageResource({ src, alt, title, width, height }: ComponentProps<"img">) {
    const [load, setLoad] = useState({ failed: false, retrying: false, attempt: 0 })
    const unavailable = !src || load.failed

    useEffect(() => {
        if (!load.retrying) return
        const timer = setTimeout(() => setLoad(current => ({ ...current, retrying: false })), 20_000)
        return () => clearTimeout(timer)
    }, [load.attempt, load.retrying])

    return (
        <Fragment>
            {src && (
                // Original pixels and dimensions are required for document export.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    key={load.attempt}
                    src={src}
                    alt={alt ?? ""}
                    title={title}
                    width={width}
                    height={height}
                    hidden={unavailable}
                    crossOrigin="anonymous"
                    decoding="async"
                    loading="eager"
                    referrerPolicy="no-referrer"
                    onLoad={() => setLoad(current => ({ ...current, failed: false, retrying: false }))}
                    onError={() => setLoad(current => ({ ...current, failed: true, retrying: false }))}
                />
            )}
            {unavailable && (
                <span className="markdown-image-error" data-image-error="true" role="status">
                    {load.retrying ? "正在重新加载图片…" : `图片无法加载${alt ? `：${alt}` : ""}。请检查图片地址、网络或原站访问限制。`}
                    {src && (
                        <button
                            className="markdown-image-retry"
                            type="button"
                            disabled={load.retrying}
                            onClick={() => setLoad(current => ({ failed: true, retrying: true, attempt: current.attempt + 1 }))}
                        >
                            重新加载图片
                        </button>
                    )}
                </span>
            )}
        </Fragment>
    )
}

function DocumentImage(props: ComponentProps<"img">) {
    // A changed URL owns a new load attempt; failure from the previous image must not persist.
    const src = typeof props.src === "string" ? getImageUrl(props.src, document.baseURI) : undefined
    return <ImageResource key={src} {...props} src={src} />
}

function TaskCheckbox({ checked }: ComponentProps<"input">) {
    return (
        <span
            className="markdown-task-checkbox"
            role="checkbox"
            aria-checked={Boolean(checked)}
            aria-disabled="true"
            aria-label={checked ? "已完成" : "未完成"}
        >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="14" height="14" rx="3" stroke="currentColor" fill={checked ? "currentColor" : "none"} />
                {checked ? <path d="m4 8 2.5 2.5L12 5" stroke="var(--doc-background)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /> : null}
            </svg>
        </span>
    )
}

const markdownComponents: Components = {
    a: DocumentLink,
    img: DocumentImage,
    input: TaskCheckbox,
}

const remarkRehypeOptions: Options["remarkRehypeOptions"] = {
    // Sanitize adds a unique prefix once, and DocumentLink applies the same prefix to local targets.
    clobberPrefix: "",
    footnoteLabel: "注释",
    footnoteLabelProperties: {},
    footnoteBackLabel: (referenceIndex, rereferenceIndex) => `返回引用 ${referenceIndex + 1}${rereferenceIndex > 1 ? `（第 ${rereferenceIndex} 次）` : ""}`,
}

export interface MarkdownDocumentProps {
    data: MarkdownDraft
    ref?: Ref<HTMLDivElement>
    className?: string
}

function MarkdownDocumentContent({ data, ref, className }: MarkdownDocumentProps) {
    const anchorId = useId()
    const anchorPrefix = `markdown-${anchorId}-`
    const rehypePlugins = useMemo(() => getRehypePlugins(anchorPrefix), [anchorPrefix])
    const { settings, source } = data

    return (
        <div
            ref={ref}
            className={cn("markdown-document", className)}
            data-document-theme={settings.theme}
            lang="zh-CN"
            style={{
                width: settings.width,
                padding: settings.padding,
                fontSize: settings.fontSize,
                lineHeight: settings.lineHeight,
                boxSizing: "border-box",
            }}
        >
            <AnchorPrefixContext value={anchorPrefix}>
                <ReactMarkdown
                    remarkPlugins={getRemarkPlugins(settings.preserveLineBreaks)}
                    remarkRehypeOptions={remarkRehypeOptions}
                    rehypePlugins={rehypePlugins}
                    components={markdownComponents}
                    urlTransform={documentUrlTransform}
                >
                    {source}
                </ReactMarkdown>
            </AnchorPrefixContext>
        </div>
    )
}

export const MarkdownDocument = memo(MarkdownDocumentContent)
