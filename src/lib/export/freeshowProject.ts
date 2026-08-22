import type { List } from "$lib/models/List"
import type { Song } from "$lib/models/Song"
import { parseSongSections } from "$lib/chords/sectionManager"
import { matchSectionHeader } from "$lib/chords/chordproParser"
import { getId } from "$lib/utils/common"
import { showToast } from "$lib/state/toast.svelte"

export interface FreeShowTextLine {
    align: string
    text: Array<{
        value: string
        style: string
    }>
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

function cleanGroupName(groupName: string): string {
    return (groupName || "Verse")
        .trim()
        .replace(/^\{(?:c(?:omment)?:\s*|section:\s*)?/i, "")
        .replace(/[\}:]+$/g, "")
        .trim() || "Verse"
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

function extractLyricsFromSectionLines(lines: string[]): string[] {
    return lines
        .filter((l) => {
            const trimmed = l.trim()
            if (!trimmed) return false
            if (trimmed.startsWith("{") && trimmed.endsWith("}")) return false
            if (matchSectionHeader(trimmed)) return false
            return true
        })
        .map((l) => l.replace(/\[[^\]]*\]/g, "").trim())
        .filter(Boolean)
}

export function convertSongToFreeShow(song: Song, transposedKey?: string): { showId: string; show: FreeShowShow } {
    const showId = getId("show")
    const layoutId = getId("layout")

    const meta: FreeShowSongMeta = {
        number: song.getMetadata ? (song.getMetadata("number") || "") : "",
        title: song.name || "",
        artist: song.getMetadata ? (song.getMetadata("artist") || "") : "",
        author: song.getMetadata ? (song.getMetadata("author") || "") : "",
        composer: song.getMetadata ? (song.getMetadata("composer") || "") : "",
        publisher: song.getMetadata ? (song.getMetadata("publisher") || "") : "",
        copyright: song.getMetadata ? (song.getMetadata("copyright") || "") : "",
        CCLI: song.getMetadata ? (song.getMetadata("ccli") || song.getMetadata("CCLI") || "") : "",
        year: song.getMetadata ? (song.getMetadata("year") || "") : "",
        key: transposedKey || (song.getMetadata ? song.getMetadata("key") : "") || ""
    }

    const sections = song.content ? parseSongSections(song.content) : []
    const slides: Record<string, FreeShowSlide> = {}
    const layoutSlides: Array<{ id: string }> = []
    const contentToSlideIdMap = new Map<string, string>()

    if (sections.length > 0) {
        for (const sec of sections) {
            const lyricLines = extractLyricsFromSectionLines(sec.lines)
            const groupName = cleanGroupName(sec.name || "Verse")
            const textContent = lyricLines.join("\n").trim()
            const contentKey = textContent ? textContent : `__empty__:${groupName.toLowerCase()}`

            let slideId = contentToSlideIdMap.get(contentKey)
            if (!slideId) {
                slideId = getId("slide")
                contentToSlideIdMap.set(contentKey, slideId)

                const items: FreeShowTextItem[] = []
                if (lyricLines.length > 0) {
                    items.push({
                        type: "text",
                        lines: lyricLines.map((line) => ({
                            align: "",
                            text: [
                                {
                                    value: line,
                                    style: "font-size:100px;"
                                }
                            ]
                        })),
                        style: "top:120px;left:50px;height:840px;width:1820px;",
                        align: ""
                    })
                }

                slides[slideId] = {
                    group: groupName,
                    color: getGroupColor(groupName),
                    settings: {},
                    children: [],
                    notes: "",
                    items
                }
            }

            layoutSlides.push({ id: slideId })
        }
    } else {
        const slideId = getId("slide")
        slides[slideId] = {
            group: "Verse",
            color: "#5825f5",
            settings: {},
            children: [],
            notes: "",
            items: []
        }
        layoutSlides.push({ id: slideId })
    }

    const layouts: Record<string, FreeShowLayout> = {
        [layoutId]: {
            name: "Default",
            notes: "",
            slides: layoutSlides
        }
    }

    const show: FreeShowShow = {
        name: song.name || "Untitled",
        category: "songs",
        settings: {
            activeLayout: layoutId,
            template: null
        },
        timestamps: {
            created: song.createdAt || Date.now(),
            modified: Date.now(),
            used: null
        },
        meta,
        slides,
        layouts,
        media: {}
    }

    return { showId, show }
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
