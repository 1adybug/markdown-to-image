import { proxyImage } from "@/features/image-proxy/proxy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(request: Request) {
    return proxyImage(request)
}
