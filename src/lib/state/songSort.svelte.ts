import type { Song } from "../models/Song"

export type SongSortOption = "title_asc" | "title_desc" | "artist_asc" | "artist_desc" | "date_desc" | "date_asc"

const STORAGE_KEY = "chordo_song_sort"

function getInitialSort(): SongSortOption {
    try {
        if (typeof localStorage !== "undefined") {
            const saved = localStorage.getItem(STORAGE_KEY) as SongSortOption
            if (saved && ["title_asc", "title_desc", "artist_asc", "artist_desc", "date_desc", "date_asc"].includes(saved)) {
                return saved
            }
        }
    } catch {
        // ignore localStorage errors in private modes
    }
    return "artist_asc"
}

export const songSortState = $state<{
    sortBy: SongSortOption
}>({
    sortBy: getInitialSort()
})

export function setSongSort(option: SongSortOption): void {
    songSortState.sortBy = option
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(STORAGE_KEY, option)
        }
    } catch {
        // ignore localStorage errors
    }
}

export function sortSongs(songs: Song[], sortBy: SongSortOption = "artist_asc"): Song[] {
    const list = [...songs]
    return list.sort((a, b) => {
        const nameA = (a.name || "").trim()
        const nameB = (b.name || "").trim()
        const artistA = (a.metadata?.artist || a.getMetadata("artist") || "").trim()
        const artistB = (b.metadata?.artist || b.getMetadata("artist") || "").trim()
        const dateA = a.createdAt || 0
        const dateB = b.createdAt || 0

        switch (sortBy) {
            case "title_asc":
                return nameA.localeCompare(nameB, undefined, { sensitivity: "base", numeric: true })
            case "title_desc":
                return nameB.localeCompare(nameA, undefined, { sensitivity: "base", numeric: true })
            case "artist_asc": {
                if (artistA && !artistB) return -1
                if (!artistA && artistB) return 1
                if (artistA && artistB) {
                    const cmp = artistA.localeCompare(artistB, undefined, { sensitivity: "base", numeric: true })
                    if (cmp !== 0) return cmp
                }
                return nameA.localeCompare(nameB, undefined, { sensitivity: "base", numeric: true })
            }
            case "artist_desc": {
                if (artistA && !artistB) return -1
                if (!artistA && artistB) return 1
                if (artistA && artistB) {
                    const cmp = artistB.localeCompare(artistA, undefined, { sensitivity: "base", numeric: true })
                    if (cmp !== 0) return cmp
                }
                return nameA.localeCompare(nameB, undefined, { sensitivity: "base", numeric: true })
            }
            case "date_desc": {
                if (dateB !== dateA) return dateB - dateA
                return nameA.localeCompare(nameB, undefined, { sensitivity: "base", numeric: true })
            }
            case "date_asc": {
                if (dateA !== dateB) return dateA - dateB
                return nameA.localeCompare(nameB, undefined, { sensitivity: "base", numeric: true })
            }
            default:
                return nameA.localeCompare(nameB, undefined, { sensitivity: "base", numeric: true })
        }
    })
}
