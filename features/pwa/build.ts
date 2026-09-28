import { createHash } from "node:crypto"
import { readdir, readFile, writeFile } from "node:fs/promises"
import { join, relative, sep } from "node:path"

import type { RsbuildPlugin } from "@rsbuild/core"

export interface WriteServiceWorkerParams {
    distPath: string
}

export async function writeServiceWorker({ distPath }: WriteServiceWorkerParams) {
    const template = await readFile(new URL("./service-worker.js", import.meta.url), "utf8")

    const files = (await readdir(distPath, { recursive: true, withFileTypes: true }))
        .filter(entry => entry.isFile())
        .map(entry => relative(distPath, join(entry.parentPath, entry.name)).split(sep).join("/"))
        .filter(path => path === "index.html" || path === "manifest.webmanifest" || /\.(?:js|css|woff2?|ttf|otf|svg|png|ico|webp)$/.test(path))
        .filter(path => path !== "sw.js")
        .sort()

    if (!files.includes("index.html") || !files.includes("manifest.webmanifest")) throw new Error("PWA 缺少首页或安装清单，无法生成离线资源。")

    const hash = createHash("sha256").update(template)
    for (const path of files) hash.update(path).update(await readFile(join(distPath, path)))
    const cacheName = `zili-chengtu-${hash.digest("hex").slice(0, 20)}`
    const urls = files.map(path => `/${path.split("/").map(encodeURIComponent).join("/")}`)
    const source = template.replace("const { cacheName, urls } = __PRECACHE__", `const { cacheName, urls } = ${JSON.stringify({ cacheName, urls })}`)
    await writeFile(join(distPath, "sw.js"), source)
    return { cacheName, urls }
}

export function pluginPwa(): RsbuildPlugin {
    return {
        name: "zili-chengtu-pwa",
        setup(api) {
            // Public files have been copied by this point. Dev/HMR never gets a worker.
            api.onAfterBuild(async ({ stats, environments }) => {
                if (stats?.hasErrors()) return

                for (const environment of Object.values(environments)) {
                    if (environment.config.output.target === "web") await writeServiceWorker({ distPath: environment.distPath })
                }
            })
        },
    }
}
