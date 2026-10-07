import proxy from "./proxy"
import { handleShare, type ShareEnv } from "./share"
import { fetchShareMetadata, renderShareHtml } from "./sharePage"

export default {
    async fetch(req: Request, env: ShareEnv): Promise<Response> {
        const url = new URL(req.url)
        const path = url.pathname

        if (path === "/api/share" || path.startsWith("/api/share/")) return handleShare(req, env)
        if (path === "/api/proxy" || path.startsWith("/api/proxy/")) return proxy.fetch(req)

        if (path === "/s" || path === "/s/") {
            const id = url.searchParams.get("id") || url.searchParams.get("s") || url.searchParams.get("share") || ""
            const details = await fetchShareMetadata(id)
            return new Response(renderShareHtml(details), { headers: { "Content-Type": "text/html; charset=utf-8" } })
        }

        return new Response("Not found", { status: 404 })
    }
}
