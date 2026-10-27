export const searchState = $state<{
    isOpen: boolean
    query: string
}>({
    isOpen: false,
    query: ""
})

export function openSearch() {
    searchState.isOpen = true
}

export function closeSearch() {
    searchState.isOpen = false
    searchState.query = ""
}

/**
 * Scores a title/name against a search query:
 * 3 = exact, 2 = prefix, 1 = substring, 0 = no match
 */
function scoreName(name: string | undefined | null, q: string): number {
    const n = (name || "").toLowerCase()
    if (!n || !n.includes(q)) return 0
    return n === q ? 3 : n.startsWith(q) ? 2 : 1
}

/**
 * Strips ChordPro directives ({title:...}) and bracketed chords ([Am])
 * to yield plain searchable lyrics text.
 */
export function getSearchableSongContent(content: string | undefined | null): string {
    if (!content) return ""
    return content.replace(/\{[^}]*\}|\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim()
}

/**
 * Scores a song against a search query with priority:
 * 1. Title match (30+)
 * 2. Metadata: artist / composer / album / etc. (20+)
 * 3. Text content / lyrics (10)
 */
export function scoreSongMatch(song: { name: string; metadata?: any; content?: string }, query: string): number {
    const q = query.trim().toLowerCase()
    if (!q) return 0

    // Priority 1: Title
    const titleScore = scoreName(song.name, q)
    if (titleScore > 0) return 30 + titleScore

    // Priority 2: Metadata
    if (song.metadata) {
        const artistScore = scoreName(song.metadata.artist, q)
        if (artistScore > 0) return 20 + artistScore

        for (const [key, value] of Object.entries(song.metadata)) {
            if (key !== "artist" && typeof value === "string" && value.toLowerCase().includes(q)) {
                return 21
            }
        }
    }

    // Priority 3: Lyrics / Content
    if (song.content && getSearchableSongContent(song.content).toLowerCase().includes(q)) {
        return 10
    }

    return 0
}

/**
 * Helper to filter and sort an array of items by score while preserving original order on ties.
 */
function filterAndSortByScore<T>(items: T[], getScore: (item: T) => number): T[] {
    return items
        .map((item, index) => ({ item, score: getScore(item), index }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map((entry) => entry.item)
}

/**
 * Searches and sorts songs by match priority (title -> metadata -> lyrics).
 */
export function searchSongs<T extends { name: string; metadata?: any; content?: string }>(songs: T[], query: string): T[] {
    const q = query.trim()
    if (!q) return songs
    return filterAndSortByScore(songs, (song) => scoreSongMatch(song, q))
}

/**
 * Generic search for named items (folders, lists).
 */
export function searchNamedItems<T extends { name: string }>(items: T[], query: string): T[] {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return filterAndSortByScore(items, (item) => scoreName(item.name, q))
}

/**
 * Searches and sorts setlist items (songs and sections).
 */
export function searchListDisplayItems<T extends { item: { name: string; song?: any } }>(items: T[], query: string): T[] {
    const q = query.trim()
    if (!q) return items
    return filterAndSortByScore(items, (entry) =>
        entry.item.song ? scoreSongMatch(entry.item.song, q) : scoreName(entry.item.name, q.toLowerCase()) * 10
    )
}
