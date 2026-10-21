import { resolve } from "node:path"

import type { NextConfig } from "next"

const config: NextConfig = {
    adapterPath: resolve("features/pwa/adapter.mjs"),
    reactCompiler: true,
    async headers() {
        return ["/sw.js", "/manifest.webmanifest"].map(source => ({
            source,
            headers: [{ key: "Cache-Control", value: "no-cache" }],
        }))
    },
}

export default config
