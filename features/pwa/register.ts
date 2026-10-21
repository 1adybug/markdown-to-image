export function registerServiceWorker() {
    if (process.env.NODE_ENV !== "production" || !window.isSecureContext || !("serviceWorker" in navigator)) return

    const register = async () => {
        try {
            await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
        } catch (error) {
            console.error("离线资源准备失败，联网功能仍可使用。", error)
        }
    }

    if (document.readyState === "complete") void register()
    else window.addEventListener("load", () => void register(), { once: true })
}
