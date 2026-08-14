import { METADATA_ALIAS_MAP, type SongMetadata } from "./metadata"

// Regex for recognizing common chord patterns
const CHORD_REGEX = /^[A-GH](b|#)?(m|maj|min|dim|aug|sus|add)?\d*(\/[A-GH](b|#)?)?$/i

function isChordToken(token: string): boolean {
    const cleaned = token.replace(/[\(\)\[\]]/g, "").trim()
    if (!cleaned) return false
    return CHORD_REGEX.test(cleaned)
}

/**
 * Checks if a single text line consists primarily of chord symbols.
 */
export function isChordLine(line: string): boolean {
    const trimmed = line.trim()
    if (!trimmed) return false

    if (/^(verse|chorus|bridge|intro|outro|refreng|mellomspill|pre-chorus|tag|coda|interlude|channel)\b/i.test(trimmed)) {
        return false
    }

    const tokens = trimmed.split(/[\s|:|,\-\/]+/).filter(Boolean)
    if (tokens.length === 0) return false

    let validChords = 0

    for (const token of tokens) {
        if (/^\(?x?\d+\)?$/i.test(token)) continue
        if (token === "." || token === "|" || token === "/") continue

        if (isChordToken(token)) {
            validChords++
        }
    }

    return validChords > 0 && validChords / tokens.length >= 0.5
}

export interface ConvertOptions {
    convertScandinavianChords?: boolean
}

export interface ExtractedSongResult {
    cleanContent: string
    metadata: SongMetadata & {
        title?: string
        artist?: string
    }
}

/**
 * Extracts metadata header directives and unbraced key-value lines from song text,
 * removes them from the content body, and converts the remaining text into ChordPro format.
 */
export function extractAndCleanSongMetadata(text: string, options: ConvertOptions = {}): ExtractedSongResult {
    const rawLines = text.split(/\r?\n/)
    const metadata: ExtractedSongResult["metadata"] = {}
    const remainingLines: string[] = []

    let i = 0
    let checkedHeaderLines = 0

    while (i < rawLines.length) {
        const line = rawLines[i]
        const trimmed = line.trim()

        if (!trimmed) {
            if (remainingLines.length > 0) {
                remainingLines.push(line)
            }
            i++
            continue
        }

        // 1. Braced directive: {key: val}
        const bracedMatch = trimmed.match(/^\{([^:]+)(?::\s*(.*?))?\}$/)
        if (bracedMatch) {
            const key = bracedMatch[1].trim().toLowerCase()
            const val = (bracedMatch[2] || "").trim()
            const targetMetaKey = METADATA_ALIAS_MAP[key]

            if (targetMetaKey) {
                ;(metadata as any)[targetMetaKey] = val
            } else {
                remainingLines.push(line)
            }
            i++
            continue
        }

        // 2. Unbraced key-value: Key: Value
        const unbracedMatch = trimmed.match(/^([a-zA-Z0-9_\-\/]+):\s*(.+)$/)
        if (unbracedMatch) {
            const key = unbracedMatch[1].trim().toLowerCase()
            const val = unbracedMatch[2].trim()
            const targetMetaKey = METADATA_ALIAS_MAP[key]

            if (targetMetaKey) {
                ;(metadata as any)[targetMetaKey] = val
                i++
                continue
            }
        }

        // 3. Line 1 = Title, Line 2 = Artist if at top of file before any section/chords
        if (checkedHeaderLines === 0 && !metadata.title && remainingLines.length === 0) {
            const nextLine = i + 1 < rawLines.length ? rawLines[i + 1].trim() : ""
            const isNextArtist = nextLine && !nextLine.includes(":") && !nextLine.includes("[") && !nextLine.includes("{") && !isChordLine(nextLine)
            if (isNextArtist) {
                metadata.title = trimmed
                metadata.artist = nextLine
                i += 2
                continue
            }
        }

        remainingLines.push(line)
        checkedHeaderLines++
        i++
    }

    const cleanContent = convertToChordPro(remainingLines.join("\n"), options)

    return {
        cleanContent,
        metadata
    }
}

/**
 * Converts formatted text input (lyrics with chord lines above them) into standard ChordPro format.
 */
export function convertToChordPro(text: string, options: ConvertOptions = {}): string {
    const lines = text.split(/\r?\n/)
    const output: string[] = []
    let i = 0

    while (i < lines.length) {
        const line = lines[i]
        const trimmed = line.trim()

        if (!trimmed) {
            output.push("")
            i++
            continue
        }

        // Section headings e.g. "Verse 1", "Verse1", "Intro:", "[Chorus]", "Ref (x2)"
        const sectionMatch = trimmed.match(/^\[?(Verse\s*\d*|Chorus\s*\d*|Bridge\s*\d*|Intro\s*\d*|Outro\s*\d*|Refreng\s*\d*|Ref\s*\(?x?\d*\)?|Mellomspill\s*\d*|Pre-Chorus\s*\d*|Tag\s*\d*|Channel\s*\d*|Alt Chorus\s*\d*)\]?:?$/i)
        if (sectionMatch) {
            let sectionName = sectionMatch[1]
            sectionName = sectionName.replace(/([a-zA-Z]+)(\d+)/, "$1 $2")
            output.push(`{c: ${sectionName}}`)
            i++
            continue
        }

        // Bracketed ChordPro lines
        if (line.includes("[") && line.includes("]")) {
            output.push(line)
            i++
            continue
        }

        // Chord lines
        if (isChordLine(line)) {
            const chordLine = line
            const nextLine = i + 1 < lines.length ? lines[i + 1] : ""

            if (nextLine && nextLine.trim() && !isChordLine(nextLine) && !/^(verse|chorus|bridge|intro|outro|refreng|mellomspill)\s*\d*/i.test(nextLine.trim()) && !/^\[?(verse|chorus|bridge|intro|outro|refreng|mellomspill)/i.test(nextLine.trim())) {
                const mergedLine = mergeChordAndLyricLines(chordLine, nextLine, options)
                output.push(mergedLine)
                i += 2
                continue
            } else {
                const standaloneFormatted = formatStandaloneChordLine(chordLine, options)
                output.push(standaloneFormatted)
                i++
                continue
            }
        }

        output.push(line)
        i++
    }

    return output
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

function mergeChordAndLyricLines(chordLine: string, lyricLine: string, options: ConvertOptions): string {
    const chordsWithPos: { chord: string; index: number }[] = []
    const chordRegex = /\S+/g
    let match: RegExpExecArray | null

    while ((match = chordRegex.exec(chordLine)) !== null) {
        const rawToken = match[0]
        if (isChordToken(rawToken)) {
            let formattedChord = rawToken
            if (options.convertScandinavianChords && formattedChord.startsWith("H")) {
                formattedChord = "B" + formattedChord.slice(1)
            }
            chordsWithPos.push({
                chord: formattedChord,
                index: match.index
            })
        }
    }

    if (chordsWithPos.length === 0) return lyricLine

    let result = ""
    let lyricIdx = 0

    for (const c of chordsWithPos) {
        const targetPos = c.index

        if (lyricIdx < targetPos) {
            result += lyricLine.slice(lyricIdx, Math.min(targetPos, lyricLine.length))
            lyricIdx = Math.min(targetPos, lyricLine.length)
        }

        if (targetPos > lyricLine.length && lyricIdx >= lyricLine.length) {
            const padLen = targetPos - lyricIdx
            result += " ".repeat(padLen)
            lyricIdx = targetPos
        }

        result += `[${c.chord}]`
    }

    if (lyricIdx < lyricLine.length) {
        result += lyricLine.slice(lyricIdx)
    }

    return result
}

function formatStandaloneChordLine(chordLine: string, options: ConvertOptions): string {
    const tokens = chordLine.split(/(\s+)/)
    let result = ""

    for (const token of tokens) {
        if (!token.trim()) {
            result += token
            continue
        }

        if (isChordToken(token)) {
            let formatted = token
            if (options.convertScandinavianChords && formatted.startsWith("H")) {
                formatted = "B" + formatted.slice(1)
            }
            result += `[${formatted}]`
        } else {
            result += token
        }
    }

    return result
}
