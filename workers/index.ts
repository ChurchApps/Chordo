import proxy from "./proxy"
import { handleShare, type ShareEnv } from "./share"
import { handleSharePage } from "./sharePage"

export default {
    async fetch(req: Request, env: ShareEnv): Promise<Response> {
        const url = new URL(req.url)
        const path = url.pathname

        if (path === "/api/share" || path.startsWith("/api/share/")) return handleShare(req, env)
        if (path === "/api/proxy" || path.startsWith("/api/proxy/")) return proxy.fetch(req)

        if (path === "/s" || path === "/s/") return handleSharePage(req)

        return new Response("Not found", { status: 404 })
    }
}
