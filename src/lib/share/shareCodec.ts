import type { SongMetadata } from "../chords/metadata"
import type { List } from "../models/List"
import type { Song } from "../models/Song"
import { FileSystem } from "../storage/FileSystem"
import { cleanPlaybackUrl } from "../utils/playback"

// --- Types ---

export type SharedSongData = {
    id?: string
    name: string
    content: string
    images?: string[]
    metadata?: SongMetadata
    playbackUrl?: string
    url?: string
    lastTransposed?: string
    createdAt?: number
    [key: string]: unknown
}

export type SharedListSongItem = {
    id?: string
    songId?: string // for backward compatibility
    type?: "song" | "section"
    isSection?: boolean // for backward compatibility
    name?: string
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

export type SongSharePayload = { type: "song"; song: SharedSongData }
export type ListSharePayload = { type: "list"; list: SharedListData }
export type SharePayload = SongSharePayload | ListSharePayload

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

function getNormalizedMetadata(song: any): Record<string, string> {
    const raw = typeof song?.getMetadata === "function" ? song.getMetadata() : song?.metadata
    if (!raw || typeof raw !== "object") return {}
    const result: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) {
        if (k === "playback" || k === "playbackUrl" || k === "spotify") continue
        if (typeof v === "string" && v.trim()) {
            result[k] = v.trim()
        }
    }
    return result
}

export function isSongContentEqual(a?: Partial<Song | SharedSongData> | null, b?: Partial<Song | SharedSongData> | null): boolean {
    if (!a && !b) return true
    if (!a || !b) return false

    if ((a.name || "").trim() !== (b.name || "").trim()) return false
    if (trimChordContent(a.content || "") !== trimChordContent(b.content || "")) return false

    const pbA = cleanPlaybackUrl(a.playbackUrl || (a as any).spotify || (a.metadata as any)?.playback || (a.metadata as any)?.spotify || "") || ""
    const pbB = cleanPlaybackUrl(b.playbackUrl || (b as any).spotify || (b.metadata as any)?.playback || (b.metadata as any)?.spotify || "") || ""
    if (pbA !== pbB) return false

    if ((a.url || "").trim() !== (b.url || "").trim()) return false
    if ((a.lastTransposed || "").trim() !== (b.lastTransposed || "").trim()) return false

    const metaA = getNormalizedMetadata(a)
    const metaB = getNormalizedMetadata(b)
    const keysA = Object.keys(metaA)
    if (keysA.length !== Object.keys(metaB).length || keysA.some((k) => metaA[k] !== metaB[k])) return false

    const imgsA = Array.isArray(a.images) ? a.images.filter((img) => typeof img === "string" && img.trim()) : []
    const imgsB = Array.isArray(b.images) ? b.images.filter((img) => typeof img === "string" && img.trim()) : []
    if (imgsA.length !== imgsB.length || imgsA.some((img, i) => img !== imgsB[i])) return false

    return true
}

export function isListContentEqual(existingList?: List | null, sharedList?: SharedListData | null, allSongs: Song[] = []): boolean {
    if (!existingList && !sharedList) return true
    if (!existingList || !sharedList) return false
    if ((existingList.name || "").trim() !== (sharedList.name || "").trim()) return false

    const existItems = existingList.songs || []
    const sharedItems: SharedListSongItem[] = sharedList.listItems?.length ? sharedList.listItems : (sharedList.songs || []).map((s) => ({ id: s.id, songId: s.id, name: s.name, transposed: s.lastTransposed }))

    if (existItems.length !== sharedItems.length) return false

    return existItems.every((eItem, i) => {
        const sItem = sharedItems[i]
        const eIsSection = Boolean(eItem.type === "section" || eItem.isSection)
        const sIsSection = Boolean(sItem.type === "section" || sItem.isSection)

        if (eIsSection !== sIsSection) return false
        if (eIsSection) return (eItem.name || "").trim() === (sItem.name || "").trim()
        if ((eItem.transposed || "").trim() !== (sItem.transposed || "").trim()) return false

        const targetSongId = sItem.id || sItem.songId
        const sharedSong = (sharedList.songs || []).find((s) => s.id === targetSongId) || (sharedList.songs || [])[i]
        const existSong = allSongs.find((s) => s.id === (eItem.id || eItem.songId))

        return isSongContentEqual(existSong, sharedSong)
    })
}

export async function cleanSongForShare(song: Song | SharedSongData): Promise<SharedSongData> {
    const rawMeta = typeof (song as Record<string, unknown>).getMetadata === "function" ? (song as Song).getMetadata() : (song as SharedSongData).metadata
    const metadata = rawMeta ? Object.fromEntries(Object.entries(rawMeta).filter(([_, v]) => typeof v === "string" && v.trim())) : undefined

    const { getMetadata, images, content, name, playbackUrl, url, ...rest } = song as Record<string, unknown>
    const trimmedContent = trimChordContent((content as string) || "")

    let base64Images: string[] | undefined
    if (!trimmedContent && Array.isArray(images) && images.length > 0) {
        const resolved = await Promise.all(images.map((img) => (typeof img === "string" && img.trim() ? FileSystem.resolveImageUrl(img) : "")))
        const valid = resolved.filter(Boolean)
        if (valid.length > 0) base64Images = valid
    }

    return {
        ...rest,
        name: (name as string) || "Untitled",
        content: trimmedContent,
        ...(base64Images ? { images: base64Images } : {}),
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
            images: Array.isArray(data.song?.images) ? data.song.images : [],
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
            images: Array.isArray(s?.images) ? s.images : [],
            metadata: s?.metadata || {},
            playbackUrl: expandUrl(s?.playbackUrl),
            url: expandUrl(s?.url)
        }))

        const listItems = (data.list?.listItems || []).map((item: any, idx: number) => {
            const isSection = item?.type === "section" || item?.isSection
            if (isSection) {
                return {
                    ...item,
                    type: "section",
                    name: item?.name || "Section"
                }
            }
            const songId = item?.id || item?.songId || (item?.songIndex !== undefined && songs[item.songIndex]?.id) || `song-${idx}`
            return {
                ...item,
                id: songId,
                songId
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

export async function buildSongSharePayload(song: Song | SharedSongData): Promise<SongSharePayload> {
    return {
        type: "song",
        song: await cleanSongForShare(song)
    }
}

export async function buildListSharePayload(list: List, allSongs: Song[]): Promise<ListSharePayload> {
    const songMap = new Map(allSongs.map((s) => [s.id, s]))
    const uniqueMap = new Map<string, number>()
    const catalogSongs: SharedSongData[] = []

    const listItems = list.songs
        .map((item) => {
            const isSection = item.type === "section" || item.isSection
            if (isSection) {
                return {
                    type: "section" as const,
                    name: item.name
                }
            }
            const songId = item.id ?? item.songId
            if (!songId) return null
            if (!uniqueMap.has(songId)) {
                const target = songMap.get(songId)
                if (target) {
                    uniqueMap.set(songId, catalogSongs.length)
                    catalogSongs.push(target as any)
                }
            }
            const index = uniqueMap.get(songId)
            const targetId = index !== undefined ? catalogSongs[index].id || `song-${index}` : songId
            return index !== undefined ? { id: targetId, songId: targetId, transposed: item.transposed } : null
        })
        .filter(Boolean) as SharedListSongItem[]

    const cleanedSongs = await Promise.all(catalogSongs.map((s) => cleanSongForShare(s)))

    return {
        type: "list",
        list: {
            id: list.id,
            name: list.name || "Untitled List",
            createdAt: list.createdAt,
            songs: cleanedSongs,
            listItems
        }
    }
}
