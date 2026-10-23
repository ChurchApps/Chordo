// Cloudflare Worker handler for OAuth token exchange and authenticated proxying
// Handles /api/oauth/token and /api/oauth/proxy

export interface OAuthEnv {
    PCO_CLIENT_SECRET?: string
    PCO_CLIENT_ID?: string
    CHURCHAPPS_CLIENT_SECRET?: string
    CHURCHAPPS_CLIENT_ID?: string
}

export async function handleOAuthRequest(req: Request, env: OAuthEnv): Promise<Response> {
    const url = new URL(req.url)
    const path = url.pathname

    if (path === "/api/oauth/token") {
        return handleTokenExchange(req, env)
    }

    if (path === "/api/oauth/proxy") {
        return handleOAuthProxy(req)
    }

    return new Response("Not found", { status: 404 })
}

async function handleTokenExchange(req: Request, env: OAuthEnv): Promise<Response> {
    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 })
    }

    try {
        const body = await req.json()
        const { provider, code, code_verifier, redirect_uri, client_id, client_secret } = body

        if (!provider || !code) {
            return new Response(JSON.stringify({ error: "Missing required parameters" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            })
        }

        const providerConfigs: Record<string, { tokenUrl: string; clientId?: string; clientSecret?: string }> = {
            planning_center: {
                tokenUrl: "https://api.planningcenteronline.com/oauth/token",
                clientId: env.PCO_CLIENT_ID,
                clientSecret: env.PCO_CLIENT_SECRET
            },
            churchapps: {
                tokenUrl: "https://api.churchapps.org/membership/oauth/token",
                clientId: env.CHURCHAPPS_CLIENT_ID,
                clientSecret: env.CHURCHAPPS_CLIENT_SECRET
            }
        }

        const config = providerConfigs[provider]
        if (!config) {
            return new Response(JSON.stringify({ error: "Unknown provider" }), { status: 400 })
        }

        const effectiveClientId = client_id || config.clientId
        const effectiveClientSecret = client_secret || config.clientSecret

        const payload: Record<string, string> = {
            grant_type: "authorization_code",
            code,
            client_id: effectiveClientId,
            redirect_uri: redirect_uri || ""
        }
        if (code_verifier) payload.code_verifier = code_verifier
        if (effectiveClientSecret) payload.client_secret = effectiveClientSecret

        const tokenRes = await fetch(config.tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })

        const tokenData = await tokenRes.text()
        return new Response(tokenData, {
            status: tokenRes.status,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        })
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || "Token exchange error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        })
    }
}

async function handleOAuthProxy(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const targetUrl = url.searchParams.get("url")

    if (!targetUrl) {
        return new Response("Missing 'url' query parameter", { status: 400 })
    }

    let parsedTarget: URL
    try {
        parsedTarget = new URL(targetUrl)
    } catch {
        return new Response("Malformed 'url' query parameter", { status: 400 })
    }

    // Only allow Planning Center and ChurchApps endpoints for security
    const allowedHosts = ["api.planningcenteronline.com", "api.churchapps.org"]
    if (!allowedHosts.includes(parsedTarget.hostname)) {
        return new Response("Target host not allowed", { status: 403 })
    }

    try {
        // Forward authorization header and accept header
        const headers: Record<string, string> = {}
        const auth = req.headers.get("Authorization")
        if (auth) headers["Authorization"] = auth

        const accept = req.headers.get("Accept")
        if (accept) headers["Accept"] = accept

        const response = await fetch(parsedTarget.toString(), {
            method: req.method,
            headers,
            redirect: "follow",
            signal: AbortSignal.timeout(10000)
        })

        const body = await response.text()
        return new Response(body, {
            status: response.status,
            headers: {
                "Content-Type": response.headers.get("Content-Type") || "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        })
    } catch (err: any) {
        return new Response(`Proxy error: ${err?.message || err}`, { status: 502 })
    }
}
