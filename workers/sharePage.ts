export type ShareDetails = {
    title: string
    description: string
}

function escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;")
}

export async function fetchShareMetadata(id: string): Promise<ShareDetails> {
    const cleanId = encodeURIComponent(id.trim().replace(/\.json$/, ""))
    if (!cleanId) {
        return getDefaultDetails()
    }

    try {
        const res = await fetch(`https://content.chordo.org/${cleanId}.json`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(2500)
        })

        if (!res.ok) return getDefaultDetails()

        const data = (await res.json()) as any
        if (!data || typeof data !== "object") return getDefaultDetails()

        if (data.type === "song" && data.song?.name) {
            const songName = data.song.name
            const artist = data.song.metadata?.artist || data.song.artist
            const key = data.song.lastTransposed || data.song.metadata?.key || data.song.key

            const artistPart = artist ? ` - ${artist}` : ""
            const keyPart = key ? ` (Key: ${key})` : ""

            return {
                title: `${songName}${artistPart} • Chordo`,
                description: `Shared chord sheet for "${songName}"${keyPart}. Check it out and save to your library.`
            }
        }

        if (data.type === "list" && data.list?.name) {
            const listName = data.list.name
            const songCount = Array.isArray(data.list.songs) ? data.list.songs.length : 0
            const countPart = songCount > 0 ? ` (${songCount} ${songCount === 1 ? "song" : "songs"})` : ""

            return {
                title: `${listName} • Chordo Setlist`,
                description: `Shared setlist "${listName}"${countPart}. Check it out and save to your library.`
            }
        }
    } catch (e) {
        console.error("Worker metadata fetch error:", e)
    }

    return getDefaultDetails()
}

function getDefaultDetails(): ShareDetails {
    return {
        title: "Shared Chord Sheet • Chordo",
        description: "Someone shared a chord sheet with you on Chordo. Check it out and save to your library."
    }
}

export function renderShareHtml(details: ShareDetails): string {
    const title = escapeHtml(details.title)
    const description = escapeHtml(details.description)

    return `<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />

        <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />

        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" />
        <meta name="description" content="${description}" />
        <meta name="theme-color" content="#f5aa67" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Sheets" />

        <title>${title}</title>

        <!-- Open Graph -->
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Chordo" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:image" content="https://chordo.org/og-image.jpg" />
        <meta property="og:image:secure_url" content="https://chordo.org/og-image.jpg" />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:width" content="1280" />
        <meta property="og:image:height" content="720" />
        <meta property="og:image:alt" content="${title}" />

        <!-- Twitter / X Cards -->
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}" />
        <meta name="twitter:image" content="https://chordo.org/og-image.jpg" />
    </head>
    <body>
        <div id="app"></div>

        <script>
            window.addEventListener("vite:preloadError", () => window.location.reload())
        </script>
        <script type="module" src="/src/main.ts"></script>
    </body>
</html>`
}
