export type PlaybackProvider = "spotify" | "youtube"

export interface PlaybackInfo {
    provider: PlaybackProvider
    id: string
    embedUrl: string
    openUrl: string
    uri?: string
    type?: string
}

/**
 * Extracts YouTube video ID from various YouTube URL formats:
 * - https://www.youtube.com/watch?v=dQw4w9WgXcQ
 * - https://youtu.be/dQw4w9WgXcQ
 * - https://music.youtube.com/watch?v=dQw4w9WgXcQ
 * - https://www.youtube.com/embed/dQw4w9WgXcQ
 * - https://m.youtube.com/watch?v=dQw4w9WgXcQ
 */
export function parseYouTubeId(input: string): string | null {
    if (!input) return null
    const trimmed = input.trim()

    // 1. youtu.be/ID
    const shortMatch = trimmed.match(/(?:youtu\.be\/|youtube-nocookie\.com\/embed\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/i)
    if (shortMatch) return shortMatch[1]

    // 2. youtube.com/watch?v=ID or music.youtube.com/watch?v=ID
    const longMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/i)
    if (longMatch) return longMatch[1]

    // 3. raw 11-char video ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
        return trimmed
    }

    return null
}

/**
 * Parses Spotify link into Spotify info (tracks, albums, playlists, artists, episodes, shows)
 */
export function parseSpotifyInfo(input: string): PlaybackInfo | null {
    if (!input) return null
    const trimmed = input.trim()

    // 1. URI format: spotify:track:ID or spotify:album:ID etc.
    const uriMatch = trimmed.match(/^spotify:(track|album|playlist|artist|episode|show):([a-zA-Z0-9]+)/i)
    if (uriMatch) {
        const type = uriMatch[1].toLowerCase()
        const id = uriMatch[2]
        return {
            provider: "spotify",
            type,
            id,
            embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`,
            openUrl: `https://open.spotify.com/${type}/${id}`,
            uri: `spotify:${type}:${id}`
        }
    }

    // 2. Web URL format: https://open.spotify.com/(intl-[a-z]+/)?(embed/)?(track|album|playlist|artist|episode|show)/ID
    const urlMatch = trimmed.match(/spotify\.com\/(?:intl-[a-zA-Z-]+\/)?(?:embed\/)?(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/i)
    if (urlMatch) {
        const type = urlMatch[1].toLowerCase()
        const id = urlMatch[2]
        return {
            provider: "spotify",
            type,
            id,
            embedUrl: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`,
            openUrl: `https://open.spotify.com/${type}/${id}`,
            uri: `spotify:${type}:${id}`
        }
    }

    return null
}

/**
 * Parses either Spotify or YouTube playback links.
 */
export function parsePlaybackUrl(input: string | undefined | null): PlaybackInfo | null {
    if (!input) return null
    const trimmed = input.trim()
    if (!trimmed) return null

    // Check Spotify first
    const spotify = parseSpotifyInfo(trimmed)
    if (spotify) return spotify

    // Check YouTube
    const ytId = parseYouTubeId(trimmed)
    if (ytId) {
        return {
            provider: "youtube",
            id: ytId,
            embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0`,
            openUrl: `https://www.youtube.com/watch?v=${ytId}`
        }
    }

    return null
}

/**
 * Cleans tracking query parameters (like ?si=...) from Spotify and YouTube URLs.
 */
export function cleanPlaybackUrl(urlOrUri: string | undefined | null): string {
    if (!urlOrUri) return ""
    const trimmed = urlOrUri.trim()
    if (!trimmed) return ""

    const info = parsePlaybackUrl(trimmed)
    if (info) {
        if (info.provider === "spotify") {
            if (trimmed.startsWith("spotify:")) {
                return info.uri || trimmed
            }
            return info.openUrl
        }
        if (info.provider === "youtube") {
            return info.openUrl
        }
    }

    try {
        const parsed = new URL(trimmed)
        parsed.searchParams.delete("si")
        parsed.searchParams.delete("utm_source")
        parsed.searchParams.delete("utm_medium")
        parsed.searchParams.delete("utm_campaign")
        let cleaned = parsed.toString()
        if (cleaned.endsWith("?")) cleaned = cleaned.slice(0, -1)
        return cleaned
    } catch {
        return trimmed.replace(/([?&])si=[^&]*(&|$)/, (_, p1, p2) => (p1 === "?" && p2 ? "?" : ""))
    }
}

/**
 * Opens playback URL in external app or web.
 */
export function openExternalPlayback(urlOrUri: string | undefined | null): void {
    if (!urlOrUri) return
    const info = parsePlaybackUrl(urlOrUri)
    if (info) {
        window.open(info.openUrl, "_blank", "noopener,noreferrer")
    } else {
        const trimmed = urlOrUri.trim()
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("spotify:")) {
            window.open(trimmed, "_blank", "noopener,noreferrer")
        }
    }
}
