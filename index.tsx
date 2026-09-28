import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import App from "./App"

import { registerServiceWorker } from "./features/pwa/register"

import "@fontsource-variable/inter"
import "@fontsource-variable/noto-sans-sc/wght.css"

import "./index.css"

const root = createRoot(document.getElementById("root") as HTMLDivElement)

root.render(
    <StrictMode>
        <App />
    </StrictMode>,
)

registerServiceWorker()
