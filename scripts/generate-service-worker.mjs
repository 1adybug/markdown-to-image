import { fileURLToPath } from "node:url"

import { writeServiceWorker } from "../features/pwa/build.mjs"

const result = await writeServiceWorker({ projectPath: fileURLToPath(new URL("../", import.meta.url)) })
console.log(`PWA: ${result.urls.length} resources, ${result.cacheName}`)
