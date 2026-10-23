import proxy from "./proxy"
import { handleShare, type ShareEnv } from "./share"
import { handleSharePage } from "./sharePage"
import { handleOAuthRequest, type OAuthEnv } from "./oauth"

export default {
    async fetch(req: Request, env: ShareEnv & OAuthEnv): Promise<Response> {
        const url = new URL(req.url)
        const path = url.pathname

        if (path === "/api/share" || path.startsWith("/api/share/")) return handleShare(req, env)
        if (path === "/api/proxy" || path.startsWith("/api/proxy/")) return proxy.fetch(req)
        if (path === "/api/oauth" || path.startsWith("/api/oauth/")) return handleOAuthRequest(req, env)

        if (path === "/s" || path.startsWith("/s/")) return handleSharePage(req, env)

        return fetch(req)
    }
}
