import { defineConfig } from "@rsbuild/core"
import { pluginReact } from "@rsbuild/plugin-react"
import { pluginSvgr } from "@rsbuild/plugin-svgr"
import { pluginTailwindcss } from "@rsbuild/plugin-tailwindcss"
import { sdrrRsbuildPlugin } from "sdrr/rsbuild"

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
        },
        mountId: "root",
    },
    plugins: [
        pluginReact({
            reactCompiler: true,
        }),
        pluginSvgr(),
        pluginTailwindcss(),
        sdrrRsbuildPlugin(),
    ],
    server: {
        port: getDevelopmentPort(),
    },
    output: {
        polyfill: "entry",
    },
})
