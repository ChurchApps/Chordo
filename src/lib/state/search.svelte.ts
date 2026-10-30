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
 * Normalizes text for search comparisons:
 * - Converts to lower case
 * - Strips combining diacritical marks / accents (e.g. "é" -> "e", "ñ" -> "n")
 * - Cleans up punctuation and collapses whitespace
 */
export function normalizeSearchText(text: string | undefined | null): string {
    if (!text) return ""
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/['’`´]/g, "") // Normalize apostrophes / contractions e.g. "don't" -> "dont"
        .trim()
}

/**
 * Computes standard Levenshtein distance between two short strings.
 */
function levenshteinDistance(a: string, b: string): number {
    if (a === b) return 0
    if (!a.length) return b.length
    if (!b.length) return a.length

    const row: number[] = Array.from({ length: b.length + 1 }, (_, i) => i)

    for (let i = 1; i <= a.length; i++) {
        let prev = i - 1
        row[0] = i
        for (let j = 1; j <= b.length; j++) {
            const temp = row[j]
            if (a[i - 1] === b[j - 1]) {
                row[j] = prev
            } else {
                row[j] = Math.min(prev + 1, row[j] + 1, row[j - 1] + 1)
            }
            prev = temp
        }
    }

    return row[b.length]
}

/**
 * Checks fuzzy match of token against target words or prefixes using Levenshtein distance:
 * - 0 distance (exact): allowed
 * - length >= 4: up to 1 edit distance
 * - length >= 8: up to 2 edit distances
 */
function fuzzyWordMatch(targetWords: string[], token: string): number {
    const maxEdits = token.length >= 8 ? 2 : token.length >= 4 ? 1 : 0
    let bestScore = 0

    for (const word of targetWords) {
        if (word === token) return 1.0
        if (word.startsWith(token)) return 0.95
        if (word.includes(token)) return 0.85

        if (maxEdits > 0) {
            // Also check prefix distance for in-progress typing if word is longer than token
            const candidate = word.length > token.length ? word.slice(0, token.length) : word
            const dist = levenshteinDistance(candidate, token)
            if (dist <= maxEdits) {
                // Score between 0.6 and 0.8 depending on distance
                const score = 0.8 - dist * 0.1
                if (score > bestScore) bestScore = score
            }
        }
    }

    return bestScore
}

/**
 * Scores a title/name against a search query using normalization and fuzzy matching:
 * Returns score > 0 if matched, 0 if no match.
 */
function scoreName(rawName: string | undefined | null, rawQuery: string): number {
    const name = normalizeSearchText(rawName)
    const q = normalizeSearchText(rawQuery)
    if (!name || !q) return 0

    // Exact full string match
    if (name === q) return 10
    // Starts with full query
    if (name.startsWith(q)) return 8
    // Substring match
    if (name.includes(q)) return 6

    // Multi-token / fuzzy match
    const tokens = q.split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return 0

    const targetWords = name.split(/[\s\-_,.:;!?/()]+/).filter(Boolean)
    let totalScore = 0

    for (const token of tokens) {
        const tokenScore = fuzzyWordMatch(targetWords, token)
        if (tokenScore === 0) return 0 // All tokens must match or fuzzy match
        totalScore += tokenScore
    }

    return 2 + (totalScore / tokens.length) * 3 // Range 2 - 5
}

/**
 * Strips ChordPro directives ({title:...}) and bracketed chords ([Am])
 * to yield plain searchable lyrics text.
 */
export function getSearchableSongContent(content: string | undefined | null): string {
    if (!content) return ""
    return content
        .replace(/\{[^}]*\}/g, " ")
        .replace(/\[[^\]]*\]/g, "")
        .replace(/\s+/g, " ")
        .trim()
}

/**
 * Scores a song against a search query with priority:
 * 1. Title match (100+)
 * 2. Metadata: artist / composer / album / etc. (50+)
 * 3. Text content / lyrics (10+)
 */
export function scoreSongMatch(song: { name: string; metadata?: any; content?: string }, rawQuery: string): number {
    const q = normalizeSearchText(rawQuery)
    if (!q) return 0

    // Priority 1: Title
    const titleScore = scoreName(song.name, q)
    if (titleScore > 0) return 100 + titleScore

    // Priority 2: Metadata
    if (song.metadata) {
        const artistScore = scoreName(song.metadata.artist, q)
        if (artistScore > 0) return 50 + artistScore

        for (const [key, value] of Object.entries(song.metadata)) {
            if (key !== "artist" && typeof value === "string") {
                const metaScore = scoreName(value, q)
                if (metaScore > 0) return 40 + metaScore
            }
        }
    }

    // Priority 3: Lyrics / Content
    if (song.content) {
        const lyrics = normalizeSearchText(getSearchableSongContent(song.content))
        if (lyrics.includes(q)) {
            return 20
        }

        // Token match for lyrics (if user typed multiple words)
        const tokens = q.split(/\s+/).filter(Boolean)
        if (tokens.length > 1) {
            const allMatch = tokens.every((t) => lyrics.includes(t))
            if (allMatch) return 15
        }
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
    const q = query.trim()
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
        entry.item.song ? scoreSongMatch(entry.item.song, q) : scoreName(entry.item.name, q) * 10
    )
}
