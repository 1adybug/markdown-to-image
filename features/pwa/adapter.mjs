import { createRequire } from "node:module"
import process from "node:process"
import { pathToFileURL } from "node:url"

import { writeServiceWorker } from "./build.mjs"

/**
 * @param {{ platformAdapter?: import("next").NextAdapter }} params
 * @returns {import("next").NextAdapter}
 */
export function createPwaAdapter({ platformAdapter } = {}) {
    return {
        ...platformAdapter,
        name: platformAdapter ? `PWA + ${platformAdapter.name}` : "PWA",
        async onBuildComplete(params) {
            // Vercel copies public/ inside its hook, so the worker must exist first.
            const result = await writeServiceWorker({ projectPath: params.projectDir, outputs: params.outputs })
            console.log(`PWA: ${result.urls.length} resources, ${result.cacheName}`)
            await platformAdapter?.onBuildComplete?.(params)
        },
    }
}

// Preserve the platform's automatically supplied adapter and its configuration.
const platformModule = process.env.NEXT_ADAPTER_PATH
    ? await import(pathToFileURL(createRequire(import.meta.url).resolve(process.env.NEXT_ADAPTER_PATH)).href)
    : undefined

export default createPwaAdapter({ platformAdapter: platformModule?.default ?? platformModule })
