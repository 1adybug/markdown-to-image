import type { NextConfig } from "next"

const config: NextConfig = {
    reactCompiler: true,
    async headers() {
        return ["/sw.js", "/manifest.webmanifest"].map(source => ({
            source,
            headers: [{ key: "Cache-Control", value: "no-cache" }],
        }))
    },
}

export default config
