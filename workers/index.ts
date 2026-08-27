import proxy from "./proxy"
import { handleShare, type ShareEnv } from "./share"

export default {
    async fetch(req: Request, env: ShareEnv): Promise<Response> {
        const path = new URL(req.url).pathname
        if (path === "/api/share" || path.startsWith("/api/share/")) return handleShare(req, env)
        if (path === "/api/proxy" || path.startsWith("/api/proxy/")) return proxy.fetch(req)
        return new Response("Not found", { status: 404 })
    }
}
