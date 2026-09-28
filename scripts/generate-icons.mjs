import assert from "node:assert/strict"
import { Buffer } from "node:buffer"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import process from "node:process"

import { Resvg } from "@resvg/resvg-js"

const root = new URL("../", import.meta.url)
const source = await readFile(new URL("assets/logo.svg", root), "utf8")
const fullBleed = source.replace('rx="112"', 'rx="0"')
assert.notEqual(source, fullBleed, "Logo 背景必须包含 rx=112，才能生成系统裁切的满版图标。")

function png(svg, size) {
    return new Resvg(svg, { fitTo: { mode: "width", value: size }, font: { loadSystemFonts: false } }).render().asPng()
}

// ICO uses PNG frames, all rendered directly from the SVG master.
function ico(sizes) {
    const frames = sizes.map(size => png(source, size))
    const header = Buffer.alloc(6 + sizes.length * 16)
    header.writeUInt16LE(1, 2)
    header.writeUInt16LE(sizes.length, 4)
    let offset = header.length

    sizes.forEach((size, index) => {
        const entry = 6 + index * 16
        header[entry] = size
        header[entry + 1] = size
        header.writeUInt16LE(1, entry + 4)
        header.writeUInt16LE(32, entry + 6)
        header.writeUInt32LE(frames[index].length, entry + 8)
        header.writeUInt32LE(offset, entry + 12)
        offset += frames[index].length
    })

    return Buffer.concat([header, ...frames])
}

const outputs = new Map([
    ["icons/logo.svg", source],
    ["icons/maskable.svg", fullBleed],
    ["icons/icon-192.png", png(source, 192)],
    ["icons/icon-512.png", png(source, 512)],
    ["icons/maskable-512.png", png(fullBleed, 512)],
    ["apple-touch-icon.png", png(fullBleed, 180)],
    ["favicon.ico", ico([16, 32, 48])],
])

if (process.argv.includes("--check")) {
    for (const [path, content] of outputs) {
        const actual = await readFile(new URL(`public/${path}`, root))
        assert.ok(actual.equals(Buffer.from(content)), `${path} 与 SVG 源文件不一致，请运行 pnpm icons:generate。`)
    }

    console.log("全部图标均与 SVG 源文件一致。")
} else {
    await mkdir(new URL("public/icons/", root), { recursive: true })
    for (const [path, content] of outputs) await writeFile(new URL(`public/${path}`, root), content)
    console.log(`已从 assets/logo.svg 生成 ${outputs.size} 个图标文件。`)
}
