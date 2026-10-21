import { describe, expect, it } from "vitest"

import { getImageUrl } from "./image-url"

const base = "https://workspace.example/"

describe("image URLs", () => {
    it.each(["https://images.example/中文.png?token=a%2Bb&size=2#fragment", "http://images.example/photo.jpg", "//images.example/photo.png"])(
        "proxies external URL %s",
        src => {
            const actual = new URL(getImageUrl(src, base), base)
            expect(actual.pathname).toBe("/api/image")
            expect(actual.searchParams.get("url")).toBe(new URL(src, base).href)
        },
    )

    it.each([
        "/icons/logo.svg",
        "relative.png",
        "https://workspace.example/photo.png",
        "/api/image?url=https%3A%2F%2Fimages.example%2Fa.png",
        "data:image/png;base64,AAAA",
        "blob:https://workspace.example/id",
    ])("preserves local/resource URL %s", src => void expect(getImageUrl(src, base)).toBe(src))
})
