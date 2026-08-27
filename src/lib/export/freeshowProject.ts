import type { List } from "$lib/models/List"
import type { Song } from "$lib/models/Song"
import { parseSongSections } from "$lib/chords/sectionManager"
import { matchSectionHeader } from "$lib/chords/chordproParser"
import { isChordToken, transposeChord, getSemitoneDistance } from "$lib/chords/transpose"
import { isChordLine } from "$lib/chords/chordproConverter"
import { getId } from "$lib/utils/common"
import { showToast } from "$lib/state/toast.svelte"

export interface FreeShowChord {
    id: string
    pos: number
    key: string
}

export interface FreeShowTextLine {
    align: string
    text: Array<{ value: string; style: string }>
    chords?: FreeShowChord[]
}

export interface FreeShowTextItem {
    type: "text"
    lines: FreeShowTextLine[]
    style: string
    align: string
}

export interface FreeShowSlide {
    group: string | null
    color: string | null
    settings: Record<string, unknown>
    children: string[]
    notes: string
    items: FreeShowTextItem[]
}

export interface FreeShowLayout {
    name: string
    notes: string
    slides: Array<{ id: string }>
}

export interface FreeShowSongMeta {
    number: string
    title: string
    artist: string
    author: string
    composer: string
    publisher: string
    copyright: string
    CCLI: string
    year: string
    key: string
    [key: string]: string
}

export interface FreeShowShow {
    name: string
    category: string | null
    settings: {
        activeLayout: string
        template: null
    }
    timestamps: {
        created: number
        modified: number
        used: number | null
    }
    meta: FreeShowSongMeta
    slides: Record<string, FreeShowSlide>
    layouts: Record<string, FreeShowLayout>
    media: Record<string, unknown>
}

export interface FreeShowProjectItem {
    id: string
    type?: "show" | "section"
    name?: string
    notes?: string
}

export interface FreeShowProject {
    project: {
        name: string
        created: number
        modified: number
        parent: string
        shows: FreeShowProjectItem[]
    }
    shows: Record<string, FreeShowShow>
}

function getId5(): string {
    return Math.random().toString(36).substring(2, 7)
}

function cleanGroupName(groupName: string): string {
    return (
        (groupName || "Verse")
            .trim()
            .replace(/^\{(?:c(?:omment)?:\s*|section:\s*)?/i, "")
            .replace(/[\}:]+$/g, "")
            .trim() || "Verse"
    )
}

function getGroupColor(groupName: string): string {
    const lower = groupName.toLowerCase()
    if (/(?:chorus|kor|refrain|refreng|ref)\b/i.test(lower)) return "#e11d48"
    if (/(?:bridge|bro|b-del)\b/i.test(lower)) return "#10b981"
    if (/(?:pre-chorus|prechorus|pre-ref|pre-refreng)\b/i.test(lower)) return "#f59e0b"
    if (/(?:intro)\b/i.test(lower)) return "#8b5cf6"
    if (/(?:outro|ending|avslutning|coda)\b/i.test(lower)) return "#6b7280"
    if (/(?:solo|instrumental|interlude|mellomspill)\b/i.test(lower)) return "#06b6d4"
    if (/(?:tag|hook|vamp|spoken)\b/i.test(lower)) return "#ec4899"
    return "#5825f5"
}

function extractChord(rawToken: string): string | null {
    const token = rawToken.trim()
    if (!token) return null
    if (isChordToken(token)) return token

    // Match chords with rhythm slashes or dots: e.g. "E//", "Eb/G//", "A2///", "F#m7.."
    const match = token.match(/^([A-GH](?:b|#)?(?:m|maj|min|dim|aug|sus|add|alt|o|°|ø|\+|\-)?\d*(?:\/[A-GH](?:b|#)?)?)/i)
    if (match && isChordToken(match[1])) {
        return match[1]
    }
    return null
}

function parseSectionLine(rawLine: string, semitones = 0): { text: string; chords: FreeShowChord[] } | null {
    let line = rawLine.trim()
    if (!line || (line.startsWith("{") && line.endsWith("}")) || matchSectionHeader(line)) return null

    // Strip outer brackets if enclosing a bar progression or chord line: e.g. "[| Ab . . .| Cm . . .|]"
    if (/^\[.+\]$/.test(line) && (line.includes("|") || isChordLine(line.slice(1, -1)))) {
        line = line.slice(1, -1).trim()
    }

    // 1. Bracketed chordpro lines: e.g. "[Eb]Gud, vekk..." or "[|] [E//] [///] [|]"
    if (line.includes("[") && line.includes("]")) {
        const parts = line.split(/\[([^\]]+)\]/)
        const textParts = parts.filter((_, i) => i % 2 === 0)
        const hasLyrics = textParts.some((t) => /[a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF]/.test(t.replace(/[\/\|\.\-:\s]/g, "")))

        if (hasLyrics) {
            let text = ""
            const chords: FreeShowChord[] = []
            for (let i = 0; i < parts.length; i++) {
                if (i % 2 === 0) {
                    text += parts[i]
                } else {
                    const chord = extractChord(parts[i])
                    if (chord) {
                        chords.push({ id: getId5(), pos: text.length, key: transposeChord(chord, semitones) })
                    }
                }
            }
            return text.trim() || chords.length ? { text, chords } : null
        } else {
            // Chord / rhythm progression line without lyrics: e.g. "[|] [E//] [///] [|] [E] [/] [///] [|]"
            let text = ""
            const chords: FreeShowChord[] = []
            for (let i = 1; i < parts.length; i += 2) {
                const token = parts[i].trim()
                const chord = extractChord(token)
                if (chord) {
                    chords.push({ id: getId5(), pos: text.length, key: transposeChord(chord, semitones) })
                    text += " ".repeat(Math.max(token.length * 2, 8))
                } else if (token.includes("/")) {
                    text += " ".repeat(token.length * 2)
                } else if (token) {
                    text += " ".repeat(4)
                }
            }
            if (chords.length) {
                return { text: " ".repeat(text.length), chords }
            }
        }
    }

    // 2. Unbracketed chord / bar lines: e.g. "| Ab . . .| Cm . . .|" or "G   D   Em   C"
    if (isChordLine(line) || line.includes("|")) {
        const regex = /\b[A-GH](?:b|#)?(?:m|maj|min|dim|aug|sus|add|alt|o|°|ø|\+|\-)?\d*(?:\/[A-GH](?:b|#)?)?\b|\S+/g
        const chords: FreeShowChord[] = []
        let m: RegExpExecArray | null
        while ((m = regex.exec(line)) !== null) {
            const chord = extractChord(m[0])
            if (chord) {
                chords.push({ id: getId5(), pos: m.index, key: transposeChord(chord, semitones) })
            }
        }
        if (chords.length) {
            const maxPos = Math.max(...chords.map((c) => c.pos + c.key.length))
            return { text: " ".repeat(Math.max(line.length, maxPos, chords.length * 8)), chords }
        }
    }

    // 3. Plain lyric line
    return { text: line, chords: [] }
}

export function convertSongToFreeShow(song: Song, transposedKey?: string): { showId: string; show: FreeShowShow } {
    const showId = getId("show")
    const layoutId = getId("layout")
    const originalKey = song.getMetadata ? song.getMetadata("key") : ""
    const targetKey = transposedKey || originalKey || ""
    const semitones = originalKey && targetKey ? getSemitoneDistance(originalKey, targetKey) : 0

    const sections = song.content ? parseSongSections(song.content) : []
    const slides: Record<string, FreeShowSlide> = {}
    const layoutSlides: Array<{ id: string }> = []
    const slideCache = new Map<string, string>()

    if (sections.length) {
        for (const sec of sections) {
            const lines = sec.lines.map((l) => parseSectionLine(l, semitones)).filter(Boolean) as Array<{ text: string; chords: FreeShowChord[] }>
            const group = cleanGroupName(sec.name || "Verse")
            const cacheKey = lines.length ? JSON.stringify(lines.map((p) => [p.text, p.chords.map((c) => `${c.pos}:${c.key}`)])) : `empty:${group}`

            let slideId = slideCache.get(cacheKey)
            if (!slideId) {
                slideId = getId("slide")
                slideCache.set(cacheKey, slideId)
                slides[slideId] = {
                    group,
                    color: getGroupColor(group),
                    settings: {},
                    children: [],
                    notes: "",
                    items: lines.length
                        ? [
                              {
                                  type: "text",
                                  style: "top:120px;left:50px;height:840px;width:1820px;",
                                  align: "",
                                  lines: lines.map((l) => ({
                                      align: "",
                                      text: [{ value: l.text, style: "font-size:100px;" }],
                                      ...(l.chords.length ? { chords: l.chords } : {})
                                  }))
                              }
                          ]
                        : []
                }
            }
            layoutSlides.push({ id: slideId })
        }
    } else {
        const slideId = getId("slide")
        slides[slideId] = { group: "Verse", color: "#5825f5", settings: {}, children: [], notes: "", items: [] }
        layoutSlides.push({ id: slideId })
    }

    return {
        showId,
        show: {
            name: song.name || "Untitled",
            category: "songs",
            settings: { activeLayout: layoutId, template: null },
            timestamps: { created: song.createdAt || Date.now(), modified: Date.now(), used: null },
            meta: {
                number: song.getMetadata ? song.getMetadata("number") || "" : "",
                title: song.name || "",
                artist: song.getMetadata ? song.getMetadata("artist") || "" : "",
                author: song.getMetadata ? song.getMetadata("author") || "" : "",
                composer: song.getMetadata ? song.getMetadata("composer") || "" : "",
                publisher: song.getMetadata ? song.getMetadata("publisher") || "" : "",
                copyright: song.getMetadata ? song.getMetadata("copyright") || "" : "",
                CCLI: song.getMetadata ? song.getMetadata("ccli") || song.getMetadata("CCLI") || "" : "",
                year: song.getMetadata ? song.getMetadata("year") || "" : "",
                key: targetKey
            },
            slides,
            layouts: { [layoutId]: { name: "Default", notes: "", slides: layoutSlides } },
            media: {}
        }
    }
}

export function generateFreeShowProject(list: List, allSongs: Song[]): FreeShowProject {
    const projectShows: FreeShowProjectItem[] = []
    const shows: Record<string, FreeShowShow> = {}

    for (const listItem of list.songs) {
        const song = allSongs.find((s) => s.id === listItem.songId)
        if (!song) continue
        const { showId, show } = convertSongToFreeShow(song, listItem.transposed)
        projectShows.push({ id: showId })
        shows[showId] = show
    }

    return {
        project: {
            name: list.name || "Setlist",
            created: list.createdAt || Date.now(),
            modified: Date.now(),
            parent: "/",
            shows: projectShows
        },
        shows
    }
}

export function exportAsFreeShowProject(list: List, allSongs: Song[]) {
    try {
        const projectData = generateFreeShowProject(list, allSongs)
        const jsonStr = JSON.stringify(projectData, null, "\t")
        const blob = new Blob([jsonStr], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const safeName = (list.name || "Setlist").replace(/[/\\?%*:|"<>]/g, "_")
        a.download = `${safeName}.project`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        showToast("Exported FreeShow project", "success")
    } catch (err) {
        console.error("Failed to export FreeShow project:", err)
        showToast("Failed to export FreeShow project", "error")
    }
}
