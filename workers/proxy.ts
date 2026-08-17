// Cloudflare Worker: CORS proxy for the web puller.
// Route: chordo.org/api/proxy?url=... — same-origin, so no CORS headers needed.

const MAX_BYTES = 5 * 1024 * 1024

export default {
    async fetch(req: Request): Promise<Response> {
        const targetUrl = new URL(req.url).searchParams.get("url")
        if (!targetUrl) return new Response("Missing 'url' query parameter", { status: 400 })

        let target: URL
        try {
            target = new URL(targetUrl)
        } catch {
            return new Response("Malformed 'url' query parameter", { status: 400 })
        }
        // Block file:, data:, and friends — only real web fetches.
        if (target.protocol !== "https:" && target.protocol !== "http:") {
            return new Response("Only http and https URLs are supported", { status: 400 })
        }

        try {
            const response = await fetch(target, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9,no;q=0.8"
                },
                redirect: "follow",
                signal: AbortSignal.timeout(8000)
            })

            const declaredSize = Number(response.headers.get("Content-Length"))
            if (declaredSize > MAX_BYTES) {
                return new Response("Proxy error: response too large", { status: 502 })
            }

            const body = await response.text()
            // ponytail: size checked after buffering for chunked responses — stream if a target ever abuses this
            if (body.length > MAX_BYTES) {
                return new Response("Proxy error: response too large", { status: 502 })
            }

            return new Response(body, {
                status: response.status,
                headers: { "Content-Type": response.headers.get("Content-Type") || "text/html; charset=utf-8" }
            })
        } catch (err: any) {
            return new Response(`Proxy error: ${err?.message || err}`, { status: 502 })
        }
    }
}
