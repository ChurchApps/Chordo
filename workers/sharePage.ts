declare const HTMLRewriter: any

type ShareDetails = { title: string; description: string }
const DEFAULT_DETAILS: ShareDetails = {
    title: "Shared With You • Chordo",
    description: "Someone shared a chord sheet or setlist with you on Chordo. Check it out and save to your library."
}

export async function fetchShareMetadata(id: string, env?: any): Promise<ShareDetails> {
    const cleanId = encodeURIComponent(id.trim().replace(/\.json$/, ""))
    if (!cleanId) return DEFAULT_DETAILS

    try {
        const bucket = env?.S3_BUCKET || "chordo-content"
        const region = env?.AWS_REGION || "us-east-2"
        const res = await fetch(`https://${bucket}.s3.${region}.amazonaws.com/${cleanId}.json`)
        if (!res.ok) return DEFAULT_DETAILS

        const data = (await res.json()) as any
        if (!data?.type) return DEFAULT_DETAILS

        if (data.type === "song" && data.song?.name) {
            const name = data.song.name
            const artist = data.song.metadata?.artist || data.song.artist
            return {
                title: `${name}${artist ? ` - ${artist}` : ""} • Chordo`,
                description: `Shared chord sheet for "${name}". Check it out and save to your library.`
            }
        }

        if (data.type === "list" && data.list?.name) {
            const name = data.list.name
            const count = Array.isArray(data.list.songs) ? data.list.songs.length : 0
            return {
                title: `${name} • Chordo Setlist`,
                description: `Shared setlist "${name}"${count ? ` (${count} songs)` : ""}. Check it out and save to your library.`
            }
        }
    } catch (e) {
        console.error("Metadata fetch error:", e)
    }
    return DEFAULT_DETAILS
}

export async function handleSharePage(req: Request, env?: any): Promise<Response> {
    const id = new URL(req.url).searchParams.get("id") || ""
    const details = await fetchShareMetadata(id, env)

    const origin = await fetch(new URL("/index.html", req.url).toString(), { headers: req.headers })
    if (!origin.ok) return origin

    const rewriter = new HTMLRewriter()
        .on("title", { element: (e: any) => e.setInnerContent(details.title) })
        .on('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', {
            element: (e: any) => e.setAttribute("content", details.description)
        })
        .on('meta[property="og:title"], meta[name="twitter:title"]', {
            element: (e: any) => e.setAttribute("content", details.title)
        })

    const transformed = rewriter.transform(origin)
    const headers = new Headers(transformed.headers)
    headers.set("Content-Type", "text/html; charset=utf-8")
    headers.set("Cache-Control", "public, max-age=0, must-revalidate")

    return new Response(transformed.body, { status: origin.status, headers })
}
