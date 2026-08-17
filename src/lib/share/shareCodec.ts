import type { SongMetadata } from "../chords/metadata"
import type { List } from "../models/List"
import type { Song } from "../models/Song"
import { fetchShortShare } from "./shortener"

type SharedSongData = {
    id?: string
    name: string
    content: string
    metadata?: SongMetadata
    playbackUrl?: string
    url?: string
    lastTransposed?: string
    createdAt?: number
}

type SharedListSongItem = {
    songId: string
    transposed?: string
    lastKnownName?: string
}

type SharedListData = {
    id?: string
    name: string
    songs: SharedSongData[]
    listItems: SharedListSongItem[]
    createdAt?: number
}

export type SharePayload = { type: "song"; song: SharedSongData } | { type: "list"; list: SharedListData }

/*
 * WIRE SCHEMAS (Version 1 - Positional Tuples with Base64URL)
 *
 * Song Tuple:
 * [0: name, 1: content, 2: id?, 3: metadata?, 4: playbackUrl?, 5: url?, 6: lastTransposed?, 7: createdAt?]
 *
 * List Item Tuple:
 * [0: songIndexInCatalog, 1: transposed?]
 *
 * Full Share Payload:
 * Single Song: [1, "s", SongTuple]
 * List:        [1, "l", id?, name, createdAt?, SongTuple[], ListItemTuple[]]
 */

// --- Base64URL Helpers ---

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
    let binary = ""
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
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

// --- URL Normalization & Prefix Stripping ---

const URL_PREFIX_MAP: [string, string][] = [
    ["open.spotify.com/track/", "sp:"],
    ["youtube.com/watch?v=", "yt:"],
    ["youtu.be/", "yts:"],
    ["tabs.ultimate-guitar.com/tab/", "ug:"],
    ["lovsang.no/sang/", "ls:"],
    ["worshiptogether.com/songs/", "wt:"],
    ["pnwchords.com/", "pnw:"]
]

function compressUrl(url?: string): string | undefined {
    if (!url) return undefined
    const normalized = url.trim().replace(/^https?:\/\/(www\.)?/, "")

    for (const [domain, code] of URL_PREFIX_MAP) {
        if (normalized.startsWith(domain)) {
            return `${code}${normalized.slice(domain.length)}`
        }
    }
    return normalized
}

function expandUrl(shortUrl?: string): string | undefined {
    if (!shortUrl) return undefined

    for (const [domain, code] of URL_PREFIX_MAP) {
        if (shortUrl.startsWith(code)) {
            return `https://${domain}${shortUrl.slice(code.length)}`
        }
    }

    if (!shortUrl.startsWith("http://") && !shortUrl.startsWith("https://")) {
        return `https://${shortUrl}`
    }
    return shortUrl
}

// --- Chord Content Normalizer ---

function trimChordContent(content: string): string {
    if (!content) return ""
    return content
        .replace(/\r\n|\r/g, "\n")
        .replace(/\u00A0/g, " ") // Convert non-breaking spaces
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n") // Collapse excess blank lines
        .trim()
}

// --- Native Compression Streams ---

async function compressString(input: string): Promise<string> {
    const rawBytes = new TextEncoder().encode(input)
    if (typeof CompressionStream !== "undefined") {
        const stream = new Response(rawBytes as BodyInit).body?.pipeThrough(new CompressionStream("deflate-raw"))
        if (stream) {
            const buffer = await new Response(stream).arrayBuffer()
            return uint8ArrayToBase64Url(new Uint8Array(buffer))
        }
    }
    return uint8ArrayToBase64Url(rawBytes)
}

async function decompressString(encoded: string): Promise<string> {
    const bytes = base64UrlToUint8Array(encoded)
    if (typeof DecompressionStream !== "undefined") {
        try {
            const stream = new Response(bytes as BodyInit).body?.pipeThrough(new DecompressionStream("deflate-raw"))
            if (stream) {
                return await new Response(stream).text()
            }
        } catch {
            return new TextDecoder().decode(bytes)
        }
    }
    return new TextDecoder().decode(bytes)
}

// --- Positional Tuple Mappers ---

type SongTuple = [
    string, // 0: name
    string, // 1: content
    string?, // 2: id
    Record<string, string>?, // 3: metadata
    string?, // 4: playbackUrl
    string?, // 5: url
    string?, // 6: lastTransposed
    number? // 7: createdAt
]

function songToTuple(song: SharedSongData): SongTuple {
    const metaClean: Record<string, string> = {}
    if (song.metadata) {
        for (const [k, v] of Object.entries(song.metadata)) {
            if (v && typeof v === "string" && v.trim()) {
                metaClean[k] = v.trim()
            }
        }
    }
    const hasMeta = Object.keys(metaClean).length > 0

    const tuple: SongTuple = [
        song.name || "Untitled",
        trimChordContent(song.content),
        song.id || undefined,
        hasMeta ? metaClean : undefined,
        compressUrl(song.playbackUrl),
        compressUrl(song.url),
        song.lastTransposed || undefined,
        song.createdAt || undefined
    ]

    // Pop trailing undefined entries to minimize wire length
    while (tuple.length > 2 && tuple[tuple.length - 1] === undefined) {
        tuple.pop()
    }
    return tuple
}

function tupleToSong(tuple: any[]): SharedSongData {
    return {
        name: tuple[0] || "Untitled",
        content: tuple[1] || "",
        id: tuple[2] || undefined,
        metadata: tuple[3] || {},
        playbackUrl: expandUrl(tuple[4]),
        url: expandUrl(tuple[5]),
        lastTransposed: tuple[6] || undefined,
        createdAt: tuple[7] || undefined
    }
}

// --- Sharing Encoders & Decoders ---

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

    const payload = [1, "s", songToTuple(songData)]
    return compressString(JSON.stringify(payload))
}

export async function encodeListShare(list: List, allSongs: Song[]): Promise<string> {
    const songMap = new Map(allSongs.map((s) => [s.id, s]))
    const uniqueSongMap = new Map<string, number>()
    const catalogTuples: SongTuple[] = []

    // 1. Collect unique songs in a deduplicated catalog pool
    for (const item of list.songs) {
        if (!uniqueSongMap.has(item.songId)) {
            const s = songMap.get(item.songId)
            if (s) {
                uniqueSongMap.set(item.songId, catalogTuples.length)
                catalogTuples.push(
                    songToTuple({
                        id: s.id,
                        name: s.name,
                        content: s.content,
                        metadata: typeof s.getMetadata === "function" ? s.getMetadata() : s.metadata,
                        playbackUrl: s.playbackUrl,
                        url: s.url,
                        lastTransposed: s.lastTransposed,
                        createdAt: s.createdAt
                    })
                )
            }
        }
    }

    // 2. Map list items to [songIndex, transposed?] tuples (omits redundant lastKnownName)
    const listItems = list.songs
        .map((item) => {
            const songIndex = uniqueSongMap.get(item.songId)
            if (songIndex === undefined) return null
            return item.transposed ? [songIndex, item.transposed] : [songIndex]
        })
        .filter(Boolean)

    // Payload: [version, type, id, name, createdAt, songsCatalog, listItems]
    const payload = [1, "l", list.id || "", list.name, list.createdAt || 0, catalogTuples, listItems]
    return compressString(JSON.stringify(payload))
}

export async function decodeSharePayload(encoded: string): Promise<SharePayload | null> {
    if (!encoded) return null
    try {
        const jsonStr = await decompressString(encoded.trim())
        const data = JSON.parse(jsonStr)

        // Tuple decoding
        const [, type] = data

        if (type === "s" && Array.isArray(data[2])) {
            return {
                type: "song",
                song: tupleToSong(data[2])
            }
        }

        if (type === "l") {
            const [, , id, name, createdAt, rawSongs, rawItems] = data
            const songs = (rawSongs || []).map(tupleToSong)

            const listItems: SharedListSongItem[] = (rawItems || []).map((item: any[]) => {
                const songIndex = item[0]
                const targetSong = songs[songIndex]
                return {
                    songId: targetSong ? targetSong.id || `song-${songIndex}` : "",
                    transposed: item[1] || undefined
                }
            })

            return {
                type: "list",
                list: {
                    id: id || undefined,
                    name: name || "Untitled List",
                    createdAt: createdAt || undefined,
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
        // check hash: #share=... or #s=...
        const hashMatch = url.match(/#(?:share|s)=([^&]+)/)
        if (hashMatch && hashMatch[1]) return hashMatch[1]

        // check query: ?share=... or ?s=...
        const queryMatch = url.match(/[?&](?:share|s)=([^&#]+)/)
        if (queryMatch && queryMatch[1]) return queryMatch[1]

        return null
    } catch {
        return null
    }
}

export function isShortenedShareId(raw: string): boolean {
    if (!raw) return false
    if (raw.startsWith("d:")) return true
    if (/^[A-Za-z0-9_-]{4,16}$/.test(raw) && !raw.includes("[")) return true
    return false
}

export async function resolveSharePayload(raw: string): Promise<SharePayload | null> {
    if (!raw) return null
    const trimmed = raw.trim()

    // 1. If explicitly prefixed or formatted as a short ID, fetch from shortener
    if (isShortenedShareId(trimmed)) {
        const fetched = await fetchShortShare(trimmed)
        if (fetched) {
            const decoded = await decodeSharePayload(fetched)
            if (decoded) return decoded
        }
    }

    // 2. Try direct decode as compressed Base64URL
    const direct = await decodeSharePayload(trimmed)
    if (direct) return direct

    // 3. Fallback: if direct decode failed, try fetching as short ID
    if (!isShortenedShareId(trimmed)) {
        const fetched = await fetchShortShare(trimmed)
        if (fetched) {
            return await decodeSharePayload(fetched)
        }
    }

    return null
}
