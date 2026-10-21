import type { ReactNode } from "react"

import { readFileSync } from "node:fs"
import { join } from "node:path"

import type { Metadata, Viewport } from "next"

import { Registry } from "@/components/Registry"

import { PwaRegistration } from "@/features/pwa/PwaRegistration"

import "@fontsource-variable/inter"
import "@fontsource-variable/noto-sans-sc/wght.css"

import "@/index.css"

const manifest = JSON.parse(readFileSync(join(process.cwd(), "public/manifest.webmanifest"), "utf8"))

export const metadata: Metadata = {
    title: "Markdown 转图片 · 字里成图",
    description: manifest.description,
    applicationName: manifest.short_name,
    manifest: "/manifest.webmanifest",
    icons: { icon: "/icons/logo.svg", apple: "/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: manifest.short_name, statusBarStyle: "default" },
    other: { "mobile-web-app-capable": "yes" },
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: manifest.theme_color }

interface LayoutProps {
    children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
    return (
        <html lang="zh-CN" suppressHydrationWarning>
            <body>
                <Registry>
                    <div id="root">{children}</div>
                    <PwaRegistration />
                </Registry>
            </body>
        </html>
    )
}
