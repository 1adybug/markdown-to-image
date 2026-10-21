import { readFileSync } from "node:fs"

import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"
import { pluginSvgr } from "@rsbuild/plugin-svgr"
import { pluginTailwindcss } from "@rsbuild/plugin-tailwindcss"
import { sdrrRsbuildPlugin } from "sdrr/rsbuild"

import { pluginPwa } from "./features/pwa/build"

// The manifest owns installation metadata; HTML uses the same values.
interface PwaHtmlMetadata {
    description: string
    short_name: string
    theme_color: string
}

const manifest: PwaHtmlMetadata = JSON.parse(readFileSync(new URL("./public/manifest.webmanifest", import.meta.url), "utf8"))

function getDevelopmentPort() {
    const value = process.env.PORT?.trim()
    if (!value) return 5173

    const port = Number(value)

    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`PORT 必须是 1 到 65535 之间的整数，当前值为 ${JSON.stringify(value)}`)

    return port
}

export default defineConfig({
    source: {
        entry: {
            index: "./index.tsx",
        },
    },
    html: {
        title: "Markdown 转图片 · 字里成图",
        meta: {
            description: manifest.description,
            viewport: "width=device-width, initial-scale=1.0, viewport-fit=cover",
            "application-name": manifest.short_name,
            "theme-color": manifest.theme_color,
            "mobile-web-app-capable": "yes",
            "apple-mobile-web-app-capable": "yes",
            "apple-mobile-web-app-title": manifest.short_name,
            "apple-mobile-web-app-status-bar-style": "default",
        },
        tags: [
            { tag: "link", attrs: { rel: "icon", href: "/icons/logo.svg", type: "image/svg+xml", sizes: "any" } },
            { tag: "link", attrs: { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" } },
            { tag: "link", attrs: { rel: "manifest", href: "/manifest.webmanifest" } },
        ],
        mountId: "root",
    },
    plugins: [
        pluginReact({
            reactCompiler: true,
        }),
        pluginSvgr(),
        pluginTailwindcss(),
        sdrrRsbuildPlugin(),
        pluginPwa(),
    ],
    server: {
        port: getDevelopmentPort(),
    },
    output: {
        polyfill: "entry",
    },
})
