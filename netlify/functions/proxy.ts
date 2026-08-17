export default async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                "Access-Control-Allow-Headers": "*"
            }
        })
    }

    const url = new URL(req.url)
    const targetUrl = url.searchParams.get("url")
    if (!targetUrl) {
        return new Response("Missing 'url' query parameter", {
            status: 400,
            headers: { "Access-Control-Allow-Origin": "*" }
        })
    }

    try {
        const response = await fetch(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9,no;q=0.8"
            },
            redirect: "follow"
        })

        const body = await response.text()

        return new Response(body, {
            status: response.status,
            headers: {
                "Content-Type": response.headers.get("Content-Type") || "text/html; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS"
            }
        })
    } catch (err: any) {
        return new Response(`Proxy error: ${err.message || err}`, {
            status: 502,
            headers: { "Access-Control-Allow-Origin": "*" }
        })
    }
}
