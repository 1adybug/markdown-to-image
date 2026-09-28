import { afterEach, describe, expect, it, vi } from "vitest"

import { registerServiceWorker } from "./register"

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

describe("service worker registration", () => {
    function setup() {
        const register = vi.fn().mockResolvedValue({})
        vi.stubGlobal("navigator", { serviceWorker: { register } })
        vi.stubGlobal("isSecureContext", true)
        vi.stubEnv("NODE_ENV", "production")
        vi.spyOn(document, "readyState", "get").mockReturnValue("complete")
        return register
    }

    it("registers the production worker without caching its update script", () => {
        const register = setup()
        registerServiceWorker()
        expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" })
    })

    it("leaves development, insecure, and unsupported browsers untouched", () => {
        const register = setup()
        vi.stubEnv("NODE_ENV", "development")
        registerServiceWorker()
        expect(register).not.toHaveBeenCalled()
        vi.stubEnv("NODE_ENV", "production")
        vi.stubGlobal("isSecureContext", false)
        registerServiceWorker()
        expect(register).not.toHaveBeenCalled()
        vi.stubGlobal("isSecureContext", true)
        vi.stubGlobal("navigator", {})
        expect(registerServiceWorker).not.toThrow()
    })

    it("waits for page load and only registers once", () => {
        const register = setup()
        vi.spyOn(document, "readyState", "get").mockReturnValue("loading")
        registerServiceWorker()
        expect(register).not.toHaveBeenCalled()
        window.dispatchEvent(new Event("load"))
        window.dispatchEvent(new Event("load"))
        expect(register).toHaveBeenCalledOnce()
    })

    it("reports an unavailable worker without breaking the application", async () => {
        const register = setup()
        const error = new Error("registration failed")
        register.mockRejectedValue(error)
        const log = vi.spyOn(console, "error").mockImplementation(() => {})
        registerServiceWorker()
        await vi.waitFor(() => expect(log).toHaveBeenCalledWith("离线资源准备失败，联网功能仍可使用。", error))
    })
})
