import { createHash } from "node:crypto"
import { readdir, readFile, writeFile } from "node:fs/promises"
import { join, relative, sep } from "node:path"

/**
 * @param {{
 *   projectPath: string,
 *   outputs: Pick<Parameters<NonNullable<import("next").NextAdapter["onBuildComplete"]>>[0]["outputs"], "prerenders" | "staticFiles">
 * }} params
 */
export async function writeServiceWorker({ projectPath, outputs }) {
    const template = await readFile(new URL("./service-worker.js", import.meta.url), "utf8")
    const publicPath = join(projectPath, "public")

    // Next.js owns the output layout; deployment adapters can relocate prerenders.
    const homepage = outputs.prerenders.find(
        output => output.pathname === "/" && output.routeType === "page" && output.response === "complete" && output.compute === "static",
    )

    const assetPaths = outputs.staticFiles
        .filter(output => output.pathname.startsWith("/_next/static/") && /\.(?:js|css|woff2?|ttf|otf|svg|png|ico|webp)$/.test(output.pathname))
        .map(output => ({ url: output.pathname, path: output.filePath }))

    const publicAssets = (await readdir(publicPath, { recursive: true, withFileTypes: true }))
        .filter(entry => entry.isFile())
        .map(entry => relative(publicPath, join(entry.parentPath, entry.name)).split(sep).join("/"))
        .filter(path => path === "manifest.webmanifest" || path === "favicon.ico" || path === "apple-touch-icon.png" || path.startsWith("icons/"))
        .map(path => ({ url: `/${path}`, path: join(publicPath, path) }))

    if (!homepage?.fallback?.filePath || !publicAssets.some(asset => asset.url === "/manifest.webmanifest"))
        throw new Error("PWA 缺少完整的静态首页或安装清单，无法生成离线资源。")
    const assets = [{ url: "/", path: homepage.fallback.filePath }, ...assetPaths, ...publicAssets].sort((a, b) => a.url.localeCompare(b.url, "en"))
    const hash = createHash("sha256").update(template)
    for (const asset of assets) hash.update(asset.url).update(await readFile(asset.path))
    const cacheName = `zili-chengtu-${hash.digest("hex").slice(0, 20)}`
    const urls = assets.map(asset => asset.url.split("/").map(encodeURIComponent).join("/"))
    const source = template.replace("const { cacheName, urls } = __PRECACHE__", `const { cacheName, urls } = ${JSON.stringify({ cacheName, urls })}`)
    await writeFile(join(publicPath, "sw.js"), source)
    return { cacheName, urls }
}
