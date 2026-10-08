declare const HTMLRewriter: any

export type ShareDetails = {
    title: string
    description: string
}

export async function fetchShareMetadata(id: string): Promise<ShareDetails> {
    const cleanId = encodeURIComponent(id.trim().replace(/\.json$/, ""))
    if (!cleanId) return getDefaultDetails()

    try {
        const res = await fetch(`https://content.chordo.org/${cleanId}.json`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(3000)
        })
        if (!res.ok) return getDefaultDetails()

        const data = (await res.json()) as any
        if (data?.type === "song" && data.song?.name) {
            const songName = data.song.name
            const artist = data.song.metadata?.artist || data.song.artist
            return {
                title: `${songName}${artist ? ` - ${artist}` : ""} • Chordo`,
                description: `Shared chord sheet for "${songName}". Check it out and save to your library.`
            }
        }

        if (data?.type === "list" && data.list?.name) {
            const listName = data.list.name
            const count = Array.isArray(data.list.songs) ? data.list.songs.length : 0
            return {
                title: `${listName} • Chordo Setlist`,
                description: `Shared setlist "${listName}"${count > 0 ? ` (${count} ${count === 1 ? "song" : "songs"})` : ""}. Check it out and save to your library.`
            }
        }
    } catch (e) {
        console.error("Worker metadata fetch error:", e)
    }

    return getDefaultDetails()
}

function getDefaultDetails(): ShareDetails {
    return {
        title: "Shared With You • Chordo",
        description: "Someone shared a chord sheet or setlist with you on Chordo. Check it out and save to your library."
    }
}

export async function handleSharePage(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const id = url.searchParams.get("id") || url.searchParams.get("s") || url.searchParams.get("share") || ""
    const details = await fetchShareMetadata(id)

    const originResponse = await fetch(new URL("/index.html", req.url).toString(), { headers: req.headers })
    if (!originResponse.ok) return originResponse

    const rewriter = new HTMLRewriter()
        .on("title", { element: (e: any) => e.setInnerContent(details.title) })
        .on('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', {
            element: (e: any) => e.setAttribute("content", details.description)
        })
        .on('meta[property="og:title"], meta[name="twitter:title"]', {
            element: (e: any) => e.setAttribute("content", details.title)
        })

    const transformed = rewriter.transform(originResponse)
    const headers = new Headers(transformed.headers)
    headers.set("Content-Type", "text/html; charset=utf-8")
    headers.set("Cache-Control", "public, max-age=0, must-revalidate")

    return new Response(transformed.body, {
        status: originResponse.status,
        headers
    })
}
