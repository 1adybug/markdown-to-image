import type { Options, UrlTransform } from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import remarkBreaks from "remark-breaks"
import remarkCjkFriendlyStrikethrough from "remark-cjk-friendly-gfm-strikethrough/parseOnly"
import remarkCjkFriendly from "remark-cjk-friendly/parseOnly"
import remarkGfm from "remark-gfm"

const commonRemarkPlugins: NonNullable<Options["remarkPlugins"]> = [remarkGfm, remarkCjkFriendly, remarkCjkFriendlyStrikethrough]

const lineBreakRemarkPlugins: NonNullable<Options["remarkPlugins"]> = [...commonRemarkPlugins, remarkBreaks]

export function getRemarkPlugins(preserveLineBreaks: boolean) {
    return preserveLineBreaks ? lineBreakRemarkPlugins : commonRemarkPlugins
}

export function getRehypePlugins(anchorPrefix: string): NonNullable<Options["rehypePlugins"]> {
    return [
        rehypeRaw,
        [
            rehypeSanitize,
            {
                ...defaultSchema,
                clobberPrefix: anchorPrefix,
                // Only content attributes are accepted: authored CSS must not escape the document theme.
                attributes: {
                    ...defaultSchema.attributes,
                    "*": ["id", "title", "lang", "dir"],
                    img: ["src", "alt", "title", "width", "height"],
                    input: [["type", "checkbox"], ["disabled", true], "checked"],
                    ol: [...(defaultSchema.attributes?.ol ?? []), "start"],
                    li: [...(defaultSchema.attributes?.li ?? []), "value"],
                    th: ["align", "colSpan", "rowSpan"],
                    td: ["align", "colSpan", "rowSpan"],
                },
                protocols: {
                    ...defaultSchema.protocols,
                    href: ["http", "https", "mailto", "tel"],
                    src: ["http", "https", "data", "blob"],
                },
                tagNames: defaultSchema.tagNames?.filter(tag => !["picture", "source", "details", "summary"].includes(tag)),
                strip: ["script", "style", "iframe", "object", "embed", "form"],
            },
        ],
        [rehypeHighlight, { detect: false }],
    ]
}

export const documentUrlTransform: UrlTransform = (url, key) => {
    const normalized = url.trim().replace(/[\p{Cc}\s]/gu, "")
    if (key === "src" && /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z\d+/=]+$/i.test(normalized)) return url
    if (key === "src" && /^blob:https?:\/\//i.test(normalized)) return url
    const protocol = /^([a-z][a-z\d+.-]*):/i.exec(normalized)?.[1]?.toLowerCase()
    if (!protocol || protocol === "http" || protocol === "https") return url
    if (key === "href" && (protocol === "mailto" || protocol === "tel")) return url
    return undefined
}
