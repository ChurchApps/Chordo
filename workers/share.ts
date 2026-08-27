import { AwsClient } from "aws4fetch"

const MAX_BYTES = 1 * 1024 * 1024
const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const ID_LENGTH = 11
export type ShareEnv = {
    AWS_ACCESS_KEY_ID: string
    AWS_SECRET_ACCESS_KEY: string
    AWS_REGION: string
    S3_BUCKET: string
    CONTENT_PUBLIC_BASE?: string
}

function jsonResponse(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
    })
}

function mintId(): string {
    const bytes = new Uint8Array(ID_LENGTH)
    crypto.getRandomValues(bytes)
    let id = ""
    for (let i = 0; i < ID_LENGTH; i++) id += ID_ALPHABET[bytes[i]! % ID_ALPHABET.length]
    return id
}

export async function handleShare(req: Request, env: ShareEnv): Promise<Response> {
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } })
    }
    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: { Allow: "POST, OPTIONS" } })
    }

    const declaredSize = Number(req.headers.get("Content-Length") || 0)
    if (declaredSize > MAX_BYTES) return jsonResponse({ error: "Payload too large" }, 400)

    let text: string
    try {
        text = await req.text()
    } catch {
        return jsonResponse({ error: "Invalid body" }, 400)
    }
    if (text.length > MAX_BYTES) return jsonResponse({ error: "Payload too large" }, 400)

    let data: unknown
    try {
        data = JSON.parse(text)
    } catch {
        return jsonResponse({ error: "Invalid JSON" }, 400)
    }
    if (data === null || typeof data !== "object") {
        return jsonResponse({ error: "Expected a JSON object or array" }, 400)
    }

    const accessKey = env.AWS_ACCESS_KEY_ID
    const secretKey = env.AWS_SECRET_ACCESS_KEY
    const region = env.AWS_REGION
    const bucket = env.S3_BUCKET
    const publicBase = (env.CONTENT_PUBLIC_BASE || "https://content.chordo.org").replace(/\/$/, "")
    if (!accessKey || !secretKey || !region || !bucket) {
        return jsonResponse({ error: "Share storage is not configured" }, 500)
    }

    const client = new AwsClient({ accessKeyId: accessKey, secretAccessKey: secretKey, region, service: "s3" })
    const body = JSON.stringify(data)

    for (let attempt = 0; attempt < 5; attempt++) {
        const id = mintId()
        const key = `${id}.json`
        const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`
        const res = await client.fetch(url, {
            method: "PUT",
            body,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=31536000, immutable",
                "If-None-Match": "*"
            }
        })
        if (res.ok) {
            return jsonResponse({ id, url: `${publicBase}/${key}` }, 201)
        }
        if (res.status === 412 || res.status === 409) continue
        const errText = await res.text().catch(() => "")
        return jsonResponse({ error: "Failed to store share", detail: errText.slice(0, 200) }, 500)
    }

    return jsonResponse({ error: "Failed to allocate id" }, 500)
}
