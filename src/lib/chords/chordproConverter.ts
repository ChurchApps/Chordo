import { METADATA_ALIAS_MAP, type SongMetadata } from "./metadata"
import { matchSectionHeader, isChordToken } from "./chordproParser"

/**
 * Checks if a line is a guitar tab staff (e.g. "E |---0-5-2---|")
 */
export function isGuitarTabLine(line: string): boolean {
    return /^[eEhHgGdDaA]\s*\|[\-\d\s\/\\hpbtr~|]+\|?\s*$/i.test(line.trim())
}

/**
 * Checks if a single text line consists primarily of chord symbols.
 */
export function isChordLine(line: string): boolean {
    const trimmed = line.trim()
    if (!trimmed) return false
    if (isGuitarTabLine(line)) return false

    if (matchSectionHeader(trimmed)) {
        return false
    }

    const tokens = trimmed.split(/[\s|:|,\-\/]+/).filter(Boolean)
    if (tokens.length === 0) return false

    let validChords = 0
    let totalNonPunctuation = 0

    for (const token of tokens) {
        if (/^\(?x?\d+\)?$/i.test(token)) continue
        if (token === "." || token === "|" || token === "/" || token === "%" || token === "-") continue

        totalNonPunctuation++
        if (isChordToken(token)) {
            validChords++
        }
    }

    return totalNonPunctuation > 0 && validChords / totalNonPunctuation >= 0.5
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

        if (!trimmed || /^[-=_*#~]{3,}$/.test(trimmed)) {
            if (remainingLines.length > 0 && trimmed && !/^[-=_*#~]{3,}$/.test(trimmed)) {
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

        // 2. Unbraced key-value: Key: Value (e.g. "Key: G", "Tekst & melodi: ...", "T&M: ...", "Tempo: 120")
        const unbracedMatch = trimmed.match(/^([^:]+):\s*(.+)$/)
        if (unbracedMatch) {
            const key = unbracedMatch[1].trim().toLowerCase()
            let val = unbracedMatch[2].trim()
            const targetMetaKey = METADATA_ALIAS_MAP[key]

            if (targetMetaKey) {
                // Support multi-line metadata values in headers (e.g. multi-line composer list)
                while (i + 1 < rawLines.length) {
                    const nextTrim = rawLines[i + 1].trim()
                    if (!nextTrim || /^[-=_*#~]{3,}$/.test(nextTrim) || nextTrim.includes(":") || matchSectionHeader(nextTrim) || isChordLine(nextTrim)) {
                        break
                    }
                    val += " " + nextTrim
                    i++
                }
                ;(metadata as any)[targetMetaKey] = val
                i++
                continue
            }
            if (key === "web" || key === "link" || key === "website" || key === "url" || key === "source") {
                i++
                continue
            }
        }

        // 3. Header Detection at top of file before any chords/sections
        if (checkedHeaderLines === 0 && remainingLines.length === 0) {
            // Case 3a: "Title - Artist" on line 1
            const titleArtistMatch = trimmed.match(/^([^\-\|]+?)\s+[\-\|]\s+([^\[\{]+)$/) || trimmed.match(/^(.+?)\s+by\s+([^\[\{]+)$/i)
            if (titleArtistMatch && !isChordLine(trimmed)) {
                if (!metadata.title) metadata.title = titleArtistMatch[1].trim()
                if (!metadata.artist) metadata.artist = titleArtistMatch[2].trim()
                i++
                continue
            }

            // Case 3b: Line 1 = Title, Line 2 = Artist
            if (!metadata.title) {
                const nextLine = i + 1 < rawLines.length ? rawLines[i + 1].trim() : ""
                const isNextArtist = nextLine && !nextLine.includes(":") && !nextLine.includes("[") && !nextLine.includes("{") && !isChordLine(nextLine)
                if (isNextArtist) {
                    metadata.title = trimmed
                    metadata.artist = nextLine
                    i += 2
                    continue
                }
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

        // Section headings e.g. "Verse 1", "Verse 1:", "Vers 1:", "[Chorus]", "Ref (x2)"
        const section = matchSectionHeader(trimmed)
        if (section) {
            if (output.length > 0 && output[output.length - 1] !== "") {
                output.push("")
            }
            output.push(`{c: ${section}}`)
            i++
            continue
        }

        // Bracketed ChordPro lines
        if (line.includes("[") && line.includes("]")) {
            // Clean up bar lines that have brackets around every bar/chord symbol: e.g. [|] [C] [-] [-] [|]
            if (line.includes("|")) {
                const cleaned = line
                    .replace(/[\[\]]/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()
                output.push(`[${cleaned}]`)
                i++
                continue
            }
            output.push(line)
            i++
            continue
        }

        // Chord lines
        if (isChordLine(line)) {
            const chordLine = line
            const nextLine = i + 1 < lines.length ? lines[i + 1] : ""

            if (nextLine && nextLine.trim() && !isChordLine(nextLine) && !matchSectionHeader(nextLine.trim())) {
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
    const chordLeadMatch = chordLine.match(/^(\s*)/)
    const lyricLeadMatch = lyricLine.match(/^(\s*)/)
    const chordLead = chordLeadMatch ? chordLeadMatch[1].length : 0
    const lyricLead = lyricLeadMatch ? lyricLeadMatch[1].length : 0

    let normChordLine = chordLine
    let normLyricLine = lyricLine

    // Harmonize leading whitespace if lyrics are indented but chord line started at 0
    if (lyricLead > 0 && chordLead === 0) {
        normLyricLine = lyricLine.slice(lyricLead)
    }

    const chordsWithPos: { chord: string; index: number }[] = []
    const chordRegex = /\S+/g
    let match: RegExpExecArray | null

    while ((match = chordRegex.exec(normChordLine)) !== null) {
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

    if (chordsWithPos.length === 0) return normLyricLine.trimEnd()

    // Identify word boundaries in the normalized lyric line for smart snapping
    const wordRegex = /\S+/g
    const words: { text: string; start: number; end: number }[] = []
    let wMatch: RegExpExecArray | null
    while ((wMatch = wordRegex.exec(normLyricLine)) !== null) {
        words.push({
            text: wMatch[0],
            start: wMatch.index,
            end: wMatch.index + wMatch[0].length
        })
    }

    // Snap chords to start of word if placed on whitespace immediately before or near the beginning
    for (const c of chordsWithPos) {
        for (const w of words) {
            // Chord is 1 char before word start (on whitespace)
            if (c.index === w.start - 1) {
                c.index = w.start
                break
            }
            // Chord is on 1st or 2nd character of short words (<= 4 chars) or 1st char of any word
            if (c.index > w.start && c.index <= w.start + (w.text.length <= 4 ? 2 : 1)) {
                c.index = w.start
                break
            }
        }
    }

    chordsWithPos.sort((a, b) => a.index - b.index)

    let result = ""
    let lyricIdx = 0

    for (const c of chordsWithPos) {
        const targetPos = c.index

        if (lyricIdx < targetPos) {
            result += normLyricLine.slice(lyricIdx, Math.min(targetPos, normLyricLine.length))
            lyricIdx = Math.min(targetPos, normLyricLine.length)
        }

        if (targetPos > normLyricLine.length && lyricIdx >= normLyricLine.length) {
            const padLen = targetPos - lyricIdx
            result += " ".repeat(padLen)
            lyricIdx = targetPos
        }

        result += `[${c.chord}]`
    }

    if (lyricIdx < normLyricLine.length) {
        result += normLyricLine.slice(lyricIdx)
    }

    return result.trimEnd()
}

export function formatStandaloneChordLine(chordLine: string, options: ConvertOptions = {}): string {
    const trimmed = chordLine.trim()

    // If it's a bar line (contains "|"), wrap the entire measure in brackets
    if (trimmed.includes("|")) {
        const cleaned = trimmed.replace(/[\[\]]/g, " ").replace(/\s+/g, " ").trim()
        return `[${cleaned}]`
    }

    // Otherwise, wrap individual chords in brackets e.g. "G C D Em" -> "[G] [C] [D] [Em]"
    const tokens = trimmed.split(/\s+/)
    return tokens
        .map((t) => {
            if (isChordToken(t)) {
                let chord = t
                if (options.convertScandinavianChords && chord.startsWith("H")) {
                    chord = "B" + chord.slice(1)
                }
                return `[${chord}]`
            }
            return t
        })
        .join(" ")
}


