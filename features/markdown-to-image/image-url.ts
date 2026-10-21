export function getImageUrl(src: string, baseUrl: string) {
    try {
        const base = new URL(baseUrl)
        const url = new URL(src, base)
        if (!["http:", "https:"].includes(url.protocol) || url.origin === base.origin) return src
        return `/api/image?${new URLSearchParams({ url: url.href })}`
    } catch {
        return src
    }
}
