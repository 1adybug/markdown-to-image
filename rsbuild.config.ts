import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"
import { pluginSvgr } from "@rsbuild/plugin-svgr"
import { pluginTailwindcss } from "@rsbuild/plugin-tailwindcss"
import { sdrrRsbuildPlugin } from "sdrr/rsbuild"

import { pluginPwa } from "./features/pwa/build"

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
            description: "中文友好的 Markdown 转图片工具，实时预览、九种主题与高清 PNG 导出。内容在浏览器本地处理。",
            "application-name": "字里成图",
            "theme-color": "#6D28D9",
            "mobile-web-app-capable": "yes",
            "apple-mobile-web-app-capable": "yes",
            "apple-mobile-web-app-title": "字里成图",
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
