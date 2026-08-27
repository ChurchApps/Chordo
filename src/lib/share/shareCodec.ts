import type { SongMetadata } from "../chords/metadata"
import type { List } from "../models/List"
import type { Song } from "../models/Song"

// --- Types ---

export type SharedSongData = {
    id?: string
    name: string
    content: string
    metadata?: SongMetadata
    playbackUrl?: string
    url?: string
    lastTransposed?: string
    createdAt?: number
    [key: string]: unknown
}

export type SharedListSongItem = {
    songId: string
    transposed?: string
    lastKnownName?: string
    [key: string]: unknown
}

export type SharedListData = {
    id?: string
    name: string
    songs: SharedSongData[]
    listItems: SharedListSongItem[]
    createdAt?: number
    [key: string]: unknown
}

export type SharePayload = { type: "song"; song: SharedSongData } | { type: "list"; list: SharedListData }

// --- URL Normalization ---

const URL_PREFIXES: Record<string, string> = {
    "open.spotify.com/track/": "sp:",
    "youtube.com/watch?v=": "yt:",
    "youtu.be/": "yts:",
    "tabs.ultimate-guitar.com/tab/": "ug:",
    "lovsang.no/sang/": "ls:",
    "worshiptogether.com/songs/": "wt:",
    "pnwchords.com/": "pnw:"
}

export function compressUrl(url?: string): string | undefined {
    if (!url) return undefined
    const clean = url.trim().replace(/^https?:\/\/(www\.)?/, "")
    const match = Object.entries(URL_PREFIXES).find(([domain]) => clean.startsWith(domain))
    return match ? `${match[1]}${clean.slice(match[0].length)}` : clean
}

export function expandUrl(shortUrl?: string): string | undefined {
    if (!shortUrl) return undefined
    const match = Object.entries(URL_PREFIXES).find(([_, code]) => shortUrl.startsWith(code))
    if (match) return `https://${match[0]}${shortUrl.slice(match[1].length)}`
    return /^https?:\/\//.test(shortUrl) ? shortUrl : `https://${shortUrl}`
}

// --- Format Cleaners ---

export function trimChordContent(content = ""): string {
    return content
        .replace(/\r\n|\r/g, "\n")
        .replace(/\u00A0/g, " ")
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

export function cleanSongForShare(song: Song | SharedSongData): SharedSongData {
    const rawMeta = typeof (song as Record<string, unknown>).getMetadata === "function" ? (song as Song).getMetadata() : (song as SharedSongData).metadata

    const metadata = rawMeta ? Object.fromEntries(Object.entries(rawMeta).filter(([_, v]) => typeof v === "string" && v.trim())) : undefined

    const { getMetadata, images, content, name, playbackUrl, url, ...rest } = song as Record<string, unknown>

    return {
        ...rest,
        name: (name as string) || "Untitled",
        content: trimChordContent(content as string),
        ...(metadata && Object.keys(metadata).length ? { metadata } : {}),
        ...(playbackUrl ? { playbackUrl: compressUrl(playbackUrl as string) } : {}),
        ...(url ? { url: compressUrl(url as string) } : {})
    }
}

// --- Payload Handlers ---

const PAYLOAD_PARSERS: Record<string, (payload: any) => SharePayload> = {
    song: (data) => ({
        type: "song",
        song: {
            ...data.song,
            name: data.song?.name || "Untitled",
            content: data.song?.content || "",
            metadata: data.song?.metadata || {},
            playbackUrl: expandUrl(data.song?.playbackUrl),
            url: expandUrl(data.song?.url)
        }
    }),
    list: (data) => {
        const songs = (data.list?.songs || []).map((s: SharedSongData) => ({
            ...s,
            name: s?.name || "Untitled",
            content: s?.content || "",
            metadata: s?.metadata || {},
            playbackUrl: expandUrl(s?.playbackUrl),
            url: expandUrl(s?.url)
        }))

        const listItems = (data.list?.listItems || []).map((item: any, idx: number) => {
            if (item?.isSection) {
                return {
                    ...item,
                    isSection: true,
                    name: item?.name || "Section"
                }
            }
            return {
                ...item,
                songId: item?.songId || (item?.songIndex !== undefined && songs[item.songIndex]?.id) || `song-${idx}`
            }
        })

        return {
            type: "list",
            list: {
                ...data.list,
                name: data.list?.name || "Untitled List",
                songs,
                listItems
            }
        }
    }
}

export function parseSharePayload(data: any): SharePayload | null {
    if (!data || typeof data !== "object" || !data.type) return null
    const parser = PAYLOAD_PARSERS[data.type]
    return parser ? parser(data) : null
}

export function buildSongSharePayload(song: Song | SharedSongData): SharePayload {
    return {
        type: "song",
        song: cleanSongForShare(song)
    }
}

export function buildListSharePayload(list: List, allSongs: Song[]): SharePayload {
    const songMap = new Map(allSongs.map((s) => [s.id, s]))
    const uniqueMap = new Map<string, number>()
    const catalogSongs: SharedSongData[] = []

    const listItems = list.songs
        .map((item) => {
            if (item.isSection) {
                return {
                    songId: "",
                    isSection: true,
                    name: item.name
                }
            }
            if (!item.songId) return null
            if (!uniqueMap.has(item.songId)) {
                const target = songMap.get(item.songId)
                if (target) {
                    uniqueMap.set(item.songId, catalogSongs.length)
                    catalogSongs.push(cleanSongForShare(target))
                }
            }
            const index = uniqueMap.get(item.songId)
            return index !== undefined ? { songId: catalogSongs[index].id || `song-${index}`, transposed: item.transposed } : null
        })
        .filter(Boolean) as SharedListSongItem[]

    return {
        type: "list",
        list: {
            id: list.id,
            name: list.name || "Untitled List",
            createdAt: list.createdAt,
            songs: catalogSongs,
            listItems
        }
    }
}
