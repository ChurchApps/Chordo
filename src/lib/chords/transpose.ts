export const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
export const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
export const CHROMATIC_SCALE = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

// Keys that conventionally prefer flat spelling (F, Bb, Eb, Ab, Db, Gb, Dm, Gm, Cm, Fm, Bbm, Ebm)
const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm", "D#", "G#", "A#"])

export function isValidKey(key?: string): boolean {
    if (!key) return false
    return getNotePitchIndex(key) !== -1
}

export function getScaleForOriginalKey(originalKey: string): string[] {
    const norm = normalizeNote(originalKey)
    const preferFlats = norm.includes("b") || FLAT_KEYS.has(norm)
    return preferFlats ? FLAT_NOTES : SHARP_NOTES
}

/**
 * Normalizes a note string for index lookup (handling flats, sharps, casing)
 */
export function normalizeNote(note: string): string {
    if (!note) return ""
    let normalized = note.trim()
    if (!normalized) return ""

    // Handle initial letter capitalized, subsequent lowercase (e.g. Eb, Bb, F#)
    const first = normalized[0].toUpperCase()
    const rest = normalized.slice(1).toLowerCase()
    normalized = first + rest

    if (normalized === "H") return "B"
    if (normalized === "Hb") return "Bb"

    return normalized
}

export function getNotePitchIndex(note: string): number {
    const norm = normalizeNote(note)
    if (!norm) return -1

    let idx = SHARP_NOTES.indexOf(norm)
    if (idx !== -1) return idx
    return FLAT_NOTES.indexOf(norm)
}

/**
 * Calculates semitone distance to transpose from fromKey to toKey
 */
export function getSemitoneDistance(fromKey: string, toKey: string): number {
    const fromIdx = getNotePitchIndex(fromKey)
    const toIdx = getNotePitchIndex(toKey)
    if (fromIdx === -1 || toIdx === -1) return 0

    let diff = (toIdx - fromIdx) % 12
    if (diff < -6) diff += 12
    if (diff > 6) diff -= 12
    return diff
}

/**
 * Transposes a single note string by semitones.
 */
export function transposeNote(note: string, semitones: number, preferFlats = false): string {
    if (!note || semitones === 0) return note

    let normalized = normalizeNote(note)
    let index = SHARP_NOTES.indexOf(normalized)
    if (index === -1) index = FLAT_NOTES.indexOf(normalized)

    if (index === -1) return note // fallback if unknown note

    let newIndex = (index + semitones) % 12
    if (newIndex < 0) newIndex += 12

    const scale = preferFlats ? FLAT_NOTES : SHARP_NOTES
    return scale[newIndex]
}

/**
 * Transposes a full chord name (e.g. "G/B", "F#m7", "Cadd9", "Bbm")
 */
export function transposeChord(chord: string, semitones: number, preferFlats = false): string {
    if (!chord || semitones === 0) return chord

    // Handle slash chords like G/B -> transpose G and B separately
    if (chord.includes("/")) {
        const parts = chord.split("/")
        return `${transposeChord(parts[0], semitones, preferFlats)}/${transposeChord(parts[1], semitones, preferFlats)}`
    }

    // Regex to extract root note (e.g. C#, Db, G) and quality (e.g. m7, maj7, add9, sus4)
    const match = chord.match(/^([A-G][#b]?)(.*)$/)
    if (!match) return chord

    const [, root, quality] = match
    const transposedRoot = transposeNote(root, semitones, preferFlats)
    return `${transposedRoot}${quality}`
}

/**
 * Checks if song content has any chords or key metadata to transpose.
 */
export function hasTransposableContent(content?: string, explicitKey?: string, images?: string[]): boolean {
    if (images && images.length > 0) return false
    if (explicitKey && isValidKey(explicitKey)) return true
    if (!content) return false

    // Check for explicit {key: ...} or Key: ...
    if (/(\{key:\s*[^}]+\}|(?:^|\n)key:\s*\S+)/i.test(content)) return true

    // Check for bracketed chords [Am] or [G/B]
    if (/\[[A-GH][#b]?[^\]]*\]/i.test(content)) return true

    // Check for chord lines
    const lines = content.split(/\r?\n/)
    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const tokens = trimmed.split(/[\s|:|,\-\/]+/).filter(Boolean)
        if (tokens.length > 0 && tokens.some((t) => /^[A-GH](b|#)?(m|maj|min|dim|aug|sus|add)?\d*(\/[A-GH](b|#)?)?$/i.test(t.replace(/[\(\)\[\]]/g, "")))) {
            return true
        }
    }

    return false
}

/**
 * Extracts the base key of a ChordPro song (from explicit metadata or first chord).
 * If the explicit key is invalid or not provided, falls back to auto-detected key from content.
 */
export function extractBaseKey(content?: string, explicitKey?: string): string | undefined {
    if (explicitKey && isValidKey(explicitKey)) {
        return normalizeNote(explicitKey)
    }
    if (!content) return undefined

    // 1. Check for explicit {key: ...} directive or unbraced Key: ...
    const keyMatch = content.match(/\{key:\s*([^}]+)\}/i) || content.match(/(?:^|\n)key:\s*([^\r\n]+)/i)
    if (keyMatch && isValidKey(keyMatch[1])) {
        return normalizeNote(keyMatch[1])
    }

    // 2. Look for the root note of the first bracketed chord [Am]
    const bracketMatch = content.match(/\[([A-GH][#b]?)[^\]]*\]/i)
    if (bracketMatch && isValidKey(bracketMatch[1])) {
        return normalizeNote(bracketMatch[1])
    }

    // 3. Look for the first chord token in chord lines
    const lines = content.split(/\r?\n/)
    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const tokens = trimmed.split(/[\s|:|,\-\/]+/).filter(Boolean)
        for (const token of tokens) {
            const match = token.replace(/[\(\)\[\]]/g, "").match(/^([A-GH][#b]?)/i)
            if (match && /^[A-GH](b|#)?(m|maj|min|dim|aug|sus|add)?\d*(\/[A-GH](b|#)?)?$/i.test(token.replace(/[\(\)\[\]]/g, ""))) {
                if (isValidKey(match[1])) {
                    return normalizeNote(match[1])
                }
            }
        }
    }

    return undefined
}

/**
 * Calculates effective semitones to transpose a song based on explicit semitones, targetKey, or song's lastTransposed key.
 */
export function calculateTransposeSemitones(params: {
    semitones?: number
    targetKey?: string
    lastTransposed?: string
    songKey?: string
    content?: string
}): number {
    if (typeof params.semitones === "number") return params.semitones
    const effectiveTargetKey = params.targetKey || params.lastTransposed
    if (!effectiveTargetKey || !isValidKey(effectiveTargetKey)) return 0

    const baseKey = extractBaseKey(params.content, params.songKey)
    if (baseKey) {
        return getSemitoneDistance(baseKey, effectiveTargetKey)
    }
    return 0
}
