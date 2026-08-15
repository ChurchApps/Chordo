import type { List } from "../models/List"
import type { Song } from "../models/Song"
import type { SongMetadata } from "../chords/metadata"

export type SharedSongData = {
    id?: string
    name: string
    content: string
    metadata?: SongMetadata
    playbackUrl?: string
    url?: string
    lastTransposed?: string
    createdAt?: number
}

export type SharedListSongItem = {
    songId: string
    transposed?: string
    lastKnownName?: string
}

export type SharedListData = {
    id?: string
    name: string
    songs: SharedSongData[]
    listItems: SharedListSongItem[]
    createdAt?: number
}

export type SharePayload = { type: "song"; song: SharedSongData } | { type: "list"; list: SharedListData }

/**
 * Compact schema keys:
 * Song:
 * t: "s"
 * v: 1 (version)
 * i: id
 * n: name
 * c: content
 * m: metadata
 * p: playbackUrl
 * u: url
 * k: lastTransposed
 * d: createdAt
 *
 * List:
 * t: "l"
 * v: 1
 * i: id
 * n: name
 * d: createdAt
 * s: array of compact songs
 * li: array of list items [songId, transposed, lastKnownName]
 */

// Helper to convert Uint8Array to URL-safe Base64 without padding
export function uint8ArrayToBase64Url(bytes: Uint8Array): string {
    let binary = ""
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

// Helper to convert Base64URL string back to Uint8Array
export function base64UrlToUint8Array(base64Url: string): Uint8Array {
    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    while (base64.length % 4 !== 0) {
        base64 += "="
    }
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes
}

// Smart text trimming for chord sheets: preserves exact layout but strips redundant trailing/leading whitespace
export function trimChordContent(content: string): string {
    if (!content) return ""
    return content
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n")
        .replace(/^\n+/, "")
        .replace(/\n+$/, "")
}

export async function compressString(input: string): Promise<string> {
    const rawBytes = new TextEncoder().encode(input)
    if (typeof CompressionStream !== "undefined") {
        const stream = new Response(rawBytes as BodyInit).body?.pipeThrough(new CompressionStream("deflate-raw"))
        if (stream) {
            const buffer = await new Response(stream).arrayBuffer()
            return uint8ArrayToBase64Url(new Uint8Array(buffer))
        }
    }
    // Fallback: raw Base64URL
    return uint8ArrayToBase64Url(rawBytes)
}

export async function decompressString(encoded: string): Promise<string> {
    const bytes = base64UrlToUint8Array(encoded)
    if (typeof DecompressionStream !== "undefined") {
        try {
            const stream = new Response(bytes as BodyInit).body?.pipeThrough(new DecompressionStream("deflate-raw"))
            if (stream) {
                return await new Response(stream).text()
            }
        } catch {
            // Might be uncompressed or fallback
            return new TextDecoder().decode(bytes)
        }
    }
    return new TextDecoder().decode(bytes)
}

function compactSong(song: SharedSongData): any {
    const metaClean: Record<string, string> = {}
    if (song.metadata) {
        for (const [k, v] of Object.entries(song.metadata)) {
            if (v && typeof v === "string" && v.trim()) {
                metaClean[k] = v.trim()
            }
        }
    }

    const res: any = {
        n: song.name,
        c: trimChordContent(song.content)
    }
    if (song.id) res.i = song.id
    if (Object.keys(metaClean).length > 0) res.m = metaClean
    if (song.playbackUrl) res.p = song.playbackUrl
    if (song.url) res.u = song.url
    if (song.lastTransposed) res.k = song.lastTransposed
    if (song.createdAt) res.d = song.createdAt
    return res
}

function expandSong(compact: any): SharedSongData {
    return {
        id: compact.i,
        name: compact.n || "Untitled",
        content: compact.c || "",
        metadata: compact.m || {},
        playbackUrl: compact.p,
        url: compact.u,
        lastTransposed: compact.k,
        createdAt: compact.d
    }
}

export async function encodeSongShare(song: Song | SharedSongData): Promise<string> {
    const songData: SharedSongData = {
        id: song.id,
        name: song.name,
        content: song.content,
        metadata: typeof (song as any).getMetadata === "function" ? (song as Song).getMetadata() : song.metadata,
        playbackUrl: song.playbackUrl,
        url: song.url,
        lastTransposed: song.lastTransposed,
        createdAt: song.createdAt
    }

    const payload = {
        t: "s",
        v: 1,
        s: compactSong(songData)
    }

    return compressString(JSON.stringify(payload))
}

export async function encodeListShare(list: List, allSongs: Song[]): Promise<string> {
    const listSongs = list.getSongs(allSongs)
    const compactSongs = listSongs.map((s) =>
        compactSong({
            id: s.id,
            name: s.name,
            content: s.content,
            metadata: s.getMetadata(),
            playbackUrl: s.playbackUrl,
            url: s.url,
            lastTransposed: s.lastTransposed,
            createdAt: s.createdAt
        })
    )

    const listItems = list.songs.map((item) => [item.songId, item.transposed || "", item.lastKnownName || ""])

    const payload = {
        t: "l",
        v: 1,
        i: list.id,
        n: list.name,
        d: list.createdAt,
        s: compactSongs,
        li: listItems
    }

    return compressString(JSON.stringify(payload))
}

export async function decodeSharePayload(encoded: string): Promise<SharePayload | null> {
    if (!encoded) return null
    try {
        const jsonStr = await decompressString(encoded.trim())
        const data = JSON.parse(jsonStr)

        if (data.t === "s" && data.s) {
            return {
                type: "song",
                song: expandSong(data.s)
            }
        }

        if (data.t === "l" && Array.isArray(data.s)) {
            const songs = data.s.map(expandSong)
            const listItems: SharedListSongItem[] = (data.li || []).map((arr: any) => {
                if (Array.isArray(arr)) {
                    return {
                        songId: arr[0],
                        transposed: arr[1] || undefined,
                        lastKnownName: arr[2] || undefined
                    }
                }
                return arr
            })

            return {
                type: "list",
                list: {
                    id: data.i,
                    name: data.n || "Untitled List",
                    createdAt: data.d,
                    songs,
                    listItems
                }
            }
        }

        return null
    } catch (e) {
        console.error("Failed to decode share payload:", e)
        return null
    }
}

export function getShareBaseUrl(): string {
    if (typeof window !== "undefined") return window.location.origin
    return "" // TODO: add fallback default domain
}

export function createShareUrl(encodedPayload: string): string {
    const base = getShareBaseUrl()
    return `${base}/#share=${encodedPayload}`
}

export function extractSharePayloadFromUrl(url: string = typeof window !== "undefined" ? window.location.href : ""): string | null {
    if (!url) return null
    try {
        // Check hash first: #share=... or #s=...
        const hashMatch = url.match(/#(?:share|s)=([^&]+)/)
        if (hashMatch && hashMatch[1]) return hashMatch[1]

        // Check query param: ?share=... or ?s=...
        const queryMatch = url.match(/[?&](?:share|s)=([^&#]+)/)
        if (queryMatch && queryMatch[1]) return queryMatch[1]

        return null
    } catch {
        return null
    }
}
