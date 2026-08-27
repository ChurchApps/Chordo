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

const ENHARMONIC_EQUIVALENTS: Record<string, string> = {
    Cb: "B",
    "B#": "C",
    Fb: "E",
    "E#": "F",
    H: "B",
    Hb: "Bb"
}

/**
 * Normalizes a note string for index lookup (handling flats, sharps, casing, and enharmonics like Cb -> B).
 */
export function normalizeNote(note: string): string {
    if (!note) return ""
    let normalized = note.trim()
    if (!normalized) return ""

    // Handle initial letter capitalized, subsequent lowercase (e.g. Eb, Bb, F#)
    const first = normalized[0].toUpperCase()
    const rest = normalized.slice(1).toLowerCase()
    normalized = first + rest

    if (ENHARMONIC_EQUIVALENTS[normalized]) {
        return ENHARMONIC_EQUIVALENTS[normalized]
    }

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
export function transposeNote(note: string, semitones = 0, preferFlats = false): string {
    if (!note) return ""

    let normalized = normalizeNote(note)
    let index = SHARP_NOTES.indexOf(normalized)
    if (index === -1) index = FLAT_NOTES.indexOf(normalized)

    if (index === -1) return normalized // fallback if unknown note

    if (semitones === 0) return normalized

    let newIndex = (index + semitones) % 12
    if (newIndex < 0) newIndex += 12

    const scale = preferFlats ? FLAT_NOTES : SHARP_NOTES
    return scale[newIndex]
}

// Recognized chord pattern: root note (A-G / H) + optional standard chord qualities & alterations
export const CHORD_REGEX =
    /^[A-GH](b|#)?(m|maj|min|dim|aug|sus|add|alt|o|°|ø|\+|\-)?\d*(?:(?:maj|min|m|M|sus|add|dim|aug|\+|\-)?\d*)*(?:[\(\[](?:b|#|\+|\-)?\d+[\)\]])*(?:[\b#\+\-]\d+)*\.?$/i

/**
 * Checks if a token represents a valid musical chord (e.g. "G", "F#m7", "Bbsus2", "F/A").
 * Returns false for non-chords like section names ("[Bridge]", "[Chorus]"), repeat marks, or lyrics.
 */
export function isChordToken(token: string): boolean {
    const cleaned = token.replace(/[\(\)\[\]]/g, "").trim()
    if (!cleaned || cleaned === "|" || cleaned === "." || cleaned === "/" || cleaned === "%" || /^\(?x?\d+\)?$/i.test(cleaned)) {
        return false
    }

    if (cleaned.includes("/")) {
        const parts = cleaned.split("/")
        return parts.length === 2 && isChordToken(parts[0]) && isChordToken(parts[1])
    }

    return CHORD_REGEX.test(cleaned)
}

/**
 * Transposes a full chord name (e.g. "G/B", "F#m7", "Bbsus2") or bracketed bar lines (e.g. "| E | E | G#m | F# | X5").
 * Safely leaves non-chord tokens (such as section labels like "[Bridge]") untransposed.
 */
export function transposeChord(chord: string, semitones: number, preferFlats = false): string {
    if (!chord || semitones === 0) return chord

    // Handle bar line chords e.g. "| E | E | G#m | F# | X5"
    if (chord.includes("|")) {
        return chord
            .split(/([|\s]+)/)
            .map((token) => (isChordToken(token) ? transposeChord(token, semitones, preferFlats) : token))
            .join("")
    }

    if (!isChordToken(chord)) return chord

    if (chord.includes("/")) {
        const [root, bass] = chord.split("/")
        return `${transposeChord(root, semitones, preferFlats)}/${transposeChord(bass, semitones, preferFlats)}`
    }

    const match = chord.trim().match(/^([A-GH][#b]?)(.*)$/i)
    if (!match) return chord

    return `${transposeNote(match[1], semitones, preferFlats)}${match[2]}`
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
 * Converts a note into its Nashville Number System representation relative to a base key.
 * For example in key of G: G -> 1, C -> 4, D -> 5, Em -> 6m, F# -> 7, etc.
 */
export function noteToNashville(note: string, baseKey: string): string {
    if (!note || !baseKey) return note
    const noteIdx = getNotePitchIndex(note)
    const baseIdx = getNotePitchIndex(baseKey)
    if (noteIdx === -1 || baseIdx === -1) return note

    // Calculate semitone distance from base key (0 to 11)
    let semitones = (noteIdx - baseIdx) % 12
    if (semitones < 0) semitones += 12

    // Map 12 semitones to standard Nashville scale degrees
    const NASHVILLE_DEGREES: Record<number, string> = {
        0: "1",
        1: "b2",
        2: "2",
        3: "b3",
        4: "3",
        5: "4",
        6: "b5",
        7: "5",
        8: "b6",
        9: "6",
        10: "b7",
        11: "7"
    }

    return NASHVILLE_DEGREES[semitones] ?? note
}

/**
 * Converts a chord (e.g. "G/B", "Em7", "| C | D | Em |") into Nashville Number notation relative to baseKey.
 */
export function chordToNashville(chord: string, baseKey: string): string {
    if (!chord || !baseKey) return chord

    if (chord.includes("|")) {
        return chord
            .split(/([|\s]+)/)
            .map((token) => (isChordToken(token) ? chordToNashville(token, baseKey) : token))
            .join("")
    }

    if (!isChordToken(chord)) return chord

    if (chord.includes("/")) {
        const [root, bass] = chord.split("/")
        return `${chordToNashville(root, baseKey)}/${chordToNashville(bass, baseKey)}`
    }

    const match = chord.trim().match(/^([A-GH][#b]?)(.*)$/i)
    if (!match) return chord

    const rootNumber = noteToNashville(match[1], baseKey)
    return `${rootNumber}${match[2]}`
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
}): number | "NNS" {
    const effectiveTargetKey = params.targetKey || params.lastTransposed
    if (effectiveTargetKey === "NNS") return "NNS"
    if (typeof params.semitones === "number") return params.semitones
    if (!effectiveTargetKey || !isValidKey(effectiveTargetKey)) return 0

    const baseKey = extractBaseKey(params.content, params.songKey)
    if (baseKey) {
        return getSemitoneDistance(baseKey, effectiveTargetKey)
    }
    return 0
}
