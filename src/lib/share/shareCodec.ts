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
 * WIRE SCHEMAS (Version 2 - Positional Tuples)
 *
 * Song Tuple:
 * [0: name, 1: content, 2: id?, 3: metadata?, 4: playbackUrl?, 5: url?, 6: lastTransposed?, 7: createdAt?]
 *
 * List Item Tuple:
 * [0: songIndexInArray, 1: transposed?]
 *
 * Full Share Payload:
 * Single Song: [2 (version), "s", SongTuple]
 * List:        [2 (version), "l", id?, name, createdAt?, SongTuple[], ListItemTuple[]]
 *
 * Future Algorithm Note:
 * If further compression is needed, consider Brotli / Zstandard (zstd) via WASM or fflate
 * which can yield an additional 15-30% reduction over deflate-raw.
 */

// --- 2. Direct Base64URL Conversion Tables ---

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
const B64_LOOKUP = new Uint8Array(256)
for (let i = 0; i < B64_CHARS.length; i++) {
    B64_LOOKUP[B64_CHARS.charCodeAt(i)] = i
}

export function uint8ArrayToBase64Url(bytes: Uint8Array): string {
    const len = bytes.length
    let base64url = ""
    let i = 0

    for (; i + 2 < len; i += 3) {
        const b0 = bytes[i]
        const b1 = bytes[i + 1]
        const b2 = bytes[i + 2]
        base64url += B64_CHARS[b0 >> 2] + B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)] + B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] + B64_CHARS[b2 & 63]
    }

    if (i < len) {
        const b0 = bytes[i]
        base64url += B64_CHARS[b0 >> 2]
        if (i + 1 < len) {
            const b1 = bytes[i + 1]
            base64url += B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)] + B64_CHARS[(b1 & 15) << 2]
        } else {
            base64url += B64_CHARS[(b0 & 3) << 4]
        }
    }

    return base64url
}

export function base64UrlToUint8Array(base64Url: string): Uint8Array {
    const len = base64Url.length
    if (len === 0) return new Uint8Array(0)

    let validLen = len
    const bufferLen = (validLen * 3) >> 2
    const bytes = new Uint8Array(bufferLen)
    let byteIdx = 0
    let i = 0

    while (i < validLen) {
        const c0 = B64_LOOKUP[base64Url.charCodeAt(i++)]
        const c1 = i < validLen ? B64_LOOKUP[base64Url.charCodeAt(i++)] : 0
        const c2 = i < validLen ? B64_LOOKUP[base64Url.charCodeAt(i++)] : 0
        const c3 = i < validLen ? B64_LOOKUP[base64Url.charCodeAt(i++)] : 0

        bytes[byteIdx++] = (c0 << 2) | (c1 >> 4)
        if (byteIdx < bufferLen) bytes[byteIdx++] = ((c1 & 15) << 4) | (c2 >> 2)
        if (byteIdx < bufferLen) bytes[byteIdx++] = ((c2 & 3) << 6) | c3
    }

    return bytes.subarray(0, byteIdx)
}

// --- 5. URL Prefix & WWW Compression Helpers ---

// All prefixes defined without protocol or www.
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
    // Strip protocol and www. first
    const normalized = url.trim().replace(/^https?:\/\/(www\.)?/, "")

    for (const [prefixDomain, shortCode] of URL_PREFIX_MAP) {
        if (normalized.startsWith(prefixDomain)) {
            return `${shortCode}${normalized.slice(prefixDomain.length)}`
        }
    }
    return normalized
}

function expandUrl(shortUrl?: string): string | undefined {
    if (!shortUrl) return undefined

    for (const [prefixDomain, shortCode] of URL_PREFIX_MAP) {
        if (shortUrl.startsWith(shortCode)) {
            return `https://${prefixDomain}${shortUrl.slice(shortCode.length)}`
        }
    }

    // Reconstruct standard HTTPS URL if not starting with a protocol
    if (!shortUrl.startsWith("http://") && !shortUrl.startsWith("https://")) {
        return `https://${shortUrl}`
    }
    return shortUrl
}

// --- 3. Smart Text Trimming ---

export function trimChordContent(content: string): string {
    if (!content) return ""
    return content
        .replace(/\r\n|\r/g, "\n")
        .replace(/\u00A0/g, " ") // Normalize non-breaking spaces
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n") // Collapse excessive blank lines
        .replace(/^\n+/, "")
        .replace(/\n+$/, "")
}

// --- Compression Streams ---

export async function compressString(input: string): Promise<string> {
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

export async function decompressString(encoded: string): Promise<string> {
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

// --- 4. Tuple Conversion Helpers ---

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

// --- Sharing Encode / Decode ---

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

    const payload = [2, "s", songToTuple(songData)]
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
    const payload = [2, "l", list.id || "", list.name, list.createdAt || 0, catalogTuples, listItems]
    return compressString(JSON.stringify(payload))
}

export async function decodeSharePayload(encoded: string): Promise<SharePayload | null> {
    if (!encoded) return null
    try {
        const jsonStr = await decompressString(encoded.trim())
        const data = JSON.parse(jsonStr)

        // Version 2 decoding (Tuple format)
        if (Array.isArray(data) && data[0] === 2) {
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
        }

        // Backward compatibility for Version 1 payloads
        if (data && typeof data === "object") {
            if (data.t === "s" && data.s) {
                return {
                    type: "song",
                    song: {
                        id: data.s.i,
                        name: data.s.n || "Untitled",
                        content: data.s.c || "",
                        metadata: data.s.m || {},
                        playbackUrl: data.s.p,
                        url: data.s.u,
                        lastTransposed: data.s.k,
                        createdAt: data.s.d
                    }
                }
            }

            if (data.t === "l" && Array.isArray(data.s)) {
                const songs = data.s.map((compact: any) => ({
                    id: compact.i,
                    name: compact.n || "Untitled",
                    content: compact.c || "",
                    metadata: compact.m || {},
                    playbackUrl: compact.p,
                    url: compact.u,
                    lastTransposed: compact.k,
                    createdAt: compact.d
                }))

                const listItems: SharedListSongItem[] = (data.li || []).map((arr: any) => ({
                    songId: Array.isArray(arr) ? arr[0] : arr.songId,
                    transposed: (Array.isArray(arr) ? arr[1] : arr.transposed) || undefined,
                    lastKnownName: (Array.isArray(arr) ? arr[2] : arr.lastKnownName) || undefined
                }))

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
