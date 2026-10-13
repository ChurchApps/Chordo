import type { List } from "$lib/models/List"
import type { Song } from "$lib/models/Song"
import { parseSongSections } from "$lib/chords/sectionManager"
import { matchSectionHeader } from "$lib/chords/chordproParser"
import { isChordToken, isRepeatToken, transposeChord, getSemitoneDistance } from "$lib/chords/transpose"
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
    globalGroup?: string
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
        id: string
        name: string
        created: number
        modified: number
        parent: string
        shows: FreeShowProjectItem[]
    }
    shows: Record<string, FreeShowShow>
    categories: Record<string, { name: string; icon: string }>
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

// const defaultGroups = {
//     break: { color: "#f5255e" },
//     bridge: { color: "#f52598" },
//     chorus: { color: "#f525d2" },
//     intro: { color: "#d525f5" },
//     outro: { color: "#a525f5" },
//     pre_chorus: { color: "#8825f5" },
//     tag: { color: "#7525f5" },
//     verse: { color: "#5825f5" }
// }

function getGlobalGroup(groupName: string): string {
    const lower = groupName.toLowerCase()
    if (/(?:pre[-_\s]?chorus|prechorus|pre[-_\s]?ref(?:reng)?)\b/i.test(lower)) return "pre_chorus"
    if (/(?:chorus|kor|refrain|refreng|ref)\b/i.test(lower)) return "chorus"
    if (/(?:bridge|bro|b[-_\s]?del)\b/i.test(lower)) return "bridge"
    if (/(?:intro(?:duction)?|innledning)\b/i.test(lower)) return "intro"
    if (/(?:outro|ending|avslutning|coda)\b/i.test(lower)) return "outro"
    if (/(?:tag|hook|vamp|spoken)\b/i.test(lower)) return "tag"
    if (/(?:break|solo|instrumental|interlude|mellomspill)\b/i.test(lower)) return "break"
    if (/(?:verse|vers|v\d+)\b/i.test(lower) || /^v\b/i.test(lower)) return "verse"
    return "verse"
}

function getGroupColor(groupName: string): string {
    const lower = groupName.toLowerCase()
    if (/(?:pre[-_\s]?chorus|prechorus|pre[-_\s]?ref(?:reng)?)\b/i.test(lower)) return "#f59e0b"
    if (/(?:chorus|kor|refrain|refreng|ref)\b/i.test(lower)) return "#e11d48"
    if (/(?:bridge|bro|b[-_\s]?del)\b/i.test(lower)) return "#10b981"
    if (/(?:intro)\b/i.test(lower)) return "#8b5cf6"
    if (/(?:outro|ending|avslutning|coda)\b/i.test(lower)) return "#6b7280"
    if (/(?:break|solo|instrumental|interlude|mellomspill)\b/i.test(lower)) return "#06b6d4"
    if (/(?:tag|hook|vamp|spoken)\b/i.test(lower)) return "#ec4899"
    return "#5825f5"
}

function extractChord(rawToken: string): string | null {
    const token = rawToken.trim()
    if (!token) return null
    if (isChordToken(token)) return token

    // Match chords with rhythm slashes, dots, or spaces: e.g. "E//", "Eb/G//", "A2///", "F#m7.."
    const match = token.match(/^([A-GH](?:b|#)?(?:m|maj|min|dim|aug|sus|add|alt|o|°|ø|\+|\-)?\d*(?:\/[A-GH](?:b|#)?)?)([\/.\s-]+)$/i)
    if (match && isChordToken(match[1])) {
        return match[1]
    }
    return null
}

function extractRepeatCountFromBottom(lines: string[]): { repeatCount: number; cleanLines: string[] } {
    const cleanLines = [...lines]
    let bottomIdx = cleanLines.length - 1
    while (bottomIdx >= 0 && !cleanLines[bottomIdx].trim()) {
        bottomIdx--
    }

    if (bottomIdx < 0) {
        return { repeatCount: 1, cleanLines }
    }

    const rawLine = cleanLines[bottomIdx].trim()

    // 1. Bottom line is entirely a repeat directive: e.g. "[x4]", "(x4)", "[4x]", "x4"
    const standaloneMatch = rawLine.match(/^[\[\(]?\s*(?:x\s*(\d+)|(\d+)\s*x)\s*[\]\)]?$/i)
    if (standaloneMatch) {
        const count = parseInt(standaloneMatch[1] || standaloneMatch[2], 10)
        cleanLines.splice(bottomIdx, 1)
        return { repeatCount: count > 0 ? count : 1, cleanLines }
    }

    // 2. Bottom line ends with a repeat directive: e.g. "Some lyrics [x4]" or "[G]Some lyrics (x4)"
    const trailingMatch = rawLine.match(/^(.*?)[\s\t]*[\[\(]\s*(?:x\s*(\d+)|(\d+)\s*x)\s*[\]\)]\s*$/i)
    if (trailingMatch) {
        const count = parseInt(trailingMatch[2] || trailingMatch[3], 10)
        cleanLines[bottomIdx] = trailingMatch[1].trimEnd()
        return { repeatCount: count > 0 ? count : 1, cleanLines }
    }

    return { repeatCount: 1, cleanLines }
}

function trimLine(text: string, chords: FreeShowChord[] = []): { text: string; chords: FreeShowChord[] } {
    if (!text.trim()) {
        return { text: "", chords }
    }

    const leadingSpaces = text.length - text.trimStart().length
    let trimmedText = text.trimStart()

    const shiftedChords = chords.map((c) => ({
        ...c,
        pos: Math.max(0, c.pos - leadingSpaces)
    }))

    const maxChordPos = shiftedChords.reduce((max, c) => Math.max(max, c.pos), 0)
    const minLengthNeeded = shiftedChords.length > 0 ? maxChordPos : 0

    if (trimmedText.trimEnd().length >= minLengthNeeded) {
        trimmedText = trimmedText.trimEnd()
    } else {
        trimmedText = trimmedText.slice(0, Math.max(trimmedText.trimEnd().length, minLengthNeeded))
    }

    return { text: trimmedText, chords: shiftedChords }
}

function parseSectionLine(rawLine: string, semitones = 0): { text: string; chords: FreeShowChord[] } | null {
    let line = rawLine.trim()
    if (!line || (line.startsWith("{") && line.endsWith("}")) || matchSectionHeader(line) || isRepeatToken(line)) return null

    // Strip outer brackets if enclosing a single bar progression or chord line: e.g. "[| Ab . . .| Cm . . .|]"
    if (line.startsWith("[") && line.endsWith("]") && !line.slice(1, -1).includes("[") && !line.slice(1, -1).includes("]")) {
        if (line.includes("|") || isChordLine(line.slice(1, -1))) {
            line = line.slice(1, -1).trim()
        }
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
            return text.trim() || chords.length ? trimLine(text, chords) : null
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
                return trimLine("", chords)
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
            return trimLine("", chords)
        }
    }

    // 3. Plain lyric line
    return trimLine(line, [])
}

export function convertSongToFreeShow(song: Song, transposedKey?: string): { showId: string; show: FreeShowShow } {
    const showId = song.id
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
            const { repeatCount, cleanLines } = extractRepeatCountFromBottom(sec.lines)
            const lines = cleanLines.map((l) => parseSectionLine(l, semitones)).filter(Boolean) as Array<{ text: string; chords: FreeShowChord[] }>
            const group = cleanGroupName(sec.name || "Verse")
            const cacheKey = lines.length ? JSON.stringify(lines.map((p) => [p.text, p.chords.map((c) => `${c.pos}:${c.key}`)])) : `empty:${group}`

            let slideId = slideCache.get(cacheKey)
            if (!slideId) {
                slideId = getId("slide")
                slideCache.set(cacheKey, slideId)
                slides[slideId] = {
                    globalGroup: getGlobalGroup(group),
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

            const hasLyrics = lines.some((l) => /\p{L}/u.test(l.text))
            const effectiveRepeat = hasLyrics ? repeatCount : 1
            for (let r = 0; r < effectiveRepeat; r++) {
                layoutSlides.push({ id: slideId })
            }
        }
    } else {
        const slideId = getId("slide")
        slides[slideId] = { globalGroup: "verse", group: "Verse", color: "#5825f5", settings: {}, children: [], notes: "", items: [] }
        layoutSlides.push({ id: slideId })
    }

    return {
        showId,
        show: {
            name: song.name || "Untitled",
            category: "chordo",
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
        const isSection = listItem.type === "section"
        if (isSection) {
            projectShows.push({
                id: listItem.id || getId("section"),
                type: "section",
                name: listItem.name || "Section"
            })
            continue
        }

        const itemId = listItem.id
        if (!itemId) continue

        const song = allSongs.find((s) => s.id === itemId)
        if (!song) continue
        const { showId, show } = convertSongToFreeShow(song, listItem.transposed)
        projectShows.push({ id: showId })
        shows[showId] = show
    }

    return {
        project: {
            id: list.id,
            name: list.name || "Setlist",
            created: list.createdAt || Date.now(),
            modified: Date.now(),
            parent: "/",
            shows: projectShows
        },
        shows,
        categories: {
            chordo: { name: "Chordo", icon: "song" }
        }
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
