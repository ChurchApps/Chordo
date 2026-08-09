// Chromatic scales for transposition
const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

/**
 * Transposes a single note string by semitones.
 */
function transposeNote(note: string, semitones: number, preferFlats = false): string {
    if (!note || semitones === 0) return note

    // Clean note
    let normalized = note.toUpperCase()
    if (normalized === "DB") normalized = "Db"
    if (normalized === "EB") normalized = "Eb"
    if (normalized === "GB") normalized = "Gb"
    if (normalized === "AB") normalized = "Ab"
    if (normalized === "BB") normalized = "Bb"

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
