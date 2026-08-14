// Regex for recognizing common chord patterns (A-G, H, Hb, accidentals, qualities, slash chords)
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

    // Skip section headers like "Verse 1:", "Intro:", "Bridge", etc.
    if (/^(verse|chorus|bridge|intro|outro|refreng|mellomspill|pre-chorus|tag|coda|interlude|channel)\b/i.test(trimmed)) {
        return false
    }

    // Split tokens by whitespace or common measure bars
    const tokens = trimmed.split(/[\s|:|,\-\/]+/).filter(Boolean)
    if (tokens.length === 0) return false

    let validChords = 0

    for (const token of tokens) {
        // Handle repeated count markers like (x2), x4
        if (/^\(?x?\d+\)?$/i.test(token)) continue
        // Handle rhythm dots / beats like '.' or '|'
        if (token === "." || token === "|" || token === "/") continue

        if (isChordToken(token)) {
            validChords++
        }
    }

    // If at least 50% of tokens (or all non-empty tokens if 1-2 tokens) are valid chords, classify as chord line
    return validChords > 0 && validChords / tokens.length >= 0.5
}

export interface ConvertOptions {
    convertScandinavianChords?: boolean // Convert 'H' to 'B' and 'Hb'/'B' to 'Bb'
}

/**
 * Converts formatted text input (lyrics with chord lines above them) into standard ChordPro format.
 */
export function convertToChordPro(text: string, options: ConvertOptions = {}): string {
    const lines = text.split(/\r?\n/)
    const output: string[] = []
    let i = 0
    let hasTitle = false

    while (i < lines.length) {
        const line = lines[i]
        const trimmed = line.trim()

        if (!trimmed) {
            output.push("")
            i++
            continue
        }

        // 1. Check for metadata like "Title: ...", "Key: ...", "Tempo: ..."
        const metaMatch = trimmed.match(/^(Title|Key|Capo|Tempo|Time|Artist|Composer|Copyright|Album):\s*(.+)$/i)
        if (metaMatch) {
            const label = metaMatch[1].toLowerCase()
            const val = metaMatch[2].trim()
            if (label === "title") {
                output.push(`{title: ${val}}`)
                hasTitle = true
            } else if (label === "artist") {
                output.push(`{artist: ${val}}`)
            } else if (label === "key") {
                output.push(`{key: ${val}}`)
            } else if (label === "capo") {
                output.push(`{capo: ${val}}`)
            } else if (label === "tempo") {
                output.push(`{tempo: ${val}}`)
            } else if (label === "time") {
                output.push(`{time: ${val}}`)
            } else {
                output.push(`${metaMatch[1]}: ${val}`)
            }
            i++
            continue
        }

        // 2. Check for section headings e.g. "Verse 1", "Verse1", "Intro:", "[Chorus]", "Ref (x2)"
        const sectionMatch = trimmed.match(/^\[?(Verse\s*\d*|Chorus\s*\d*|Bridge\s*\d*|Intro\s*\d*|Outro\s*\d*|Refreng\s*\d*|Ref\s*\(?x?\d*\)?|Mellomspill\s*\d*|Pre-Chorus\s*\d*|Tag\s*\d*|Channel\s*\d*|Alt Chorus\s*\d*)\]?:?$/i)
        if (sectionMatch) {
            let sectionName = sectionMatch[1]
            // Format "Verse1" -> "Verse 1"
            sectionName = sectionName.replace(/([a-zA-Z]+)(\d+)/, "$1 $2")
            output.push(`{c: ${sectionName}}`)
            i++
            continue
        }

        // 3. First non-empty line title detection (if not already titled and not chords)
        if (!hasTitle && i === 0 && !isChordLine(line) && !line.includes("[")) {
            // Check if next line is blank or another section
            const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : ""
            if (!nextLine || /^(verse|chorus|bridge|intro|artist|key)\d*\b/i.test(nextLine)) {
                output.push(`{title: ${trimmed}}`)
                hasTitle = true
                i++
                continue
            }
        }

        // 4. Check if current line is already in bracketed ChordPro format
        if (line.includes("[") && line.includes("]")) {
            output.push(line)
            i++
            continue
        }

        // 5. Check if current line is a chord line
        if (isChordLine(line)) {
            const chordLine = line
            const nextLine = i + 1 < lines.length ? lines[i + 1] : ""

            // If next line exists, is not empty, is not a chord line, and not a section header, merge them
            if (
                nextLine &&
                nextLine.trim() &&
                !isChordLine(nextLine) &&
                !/^(verse|chorus|bridge|intro|outro|refreng|mellomspill)\s*\d*/i.test(nextLine.trim()) &&
                !/^\[?(verse|chorus|bridge|intro|outro|refreng|mellomspill)/i.test(nextLine.trim())
            ) {
                const mergedLine = mergeChordAndLyricLines(chordLine, nextLine, options)
                output.push(mergedLine)
                i += 2 // Consumed both chord line and lyric line
                continue
            } else {
                // Standalone chord line (e.g. Intro or Instrumental)
                const standaloneFormatted = formatStandaloneChordLine(chordLine, options)
                output.push(standaloneFormatted)
                i++
                continue
            }
        }

        // Standard lyric line without chords above it
        output.push(line)
        i++
    }

    return output.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

/**
 * Merges a line containing chords above a line containing lyrics.
 */
function mergeChordAndLyricLines(chordLine: string, lyricLine: string, options: ConvertOptions): string {
    const chordsWithPos: { chord: string; index: number }[] = []
    const chordRegex = /\S+/g
    let match: RegExpExecArray | null

    while ((match = chordRegex.exec(chordLine)) !== null) {
        const rawToken = match[0]
        if (isChordToken(rawToken)) {
            let formattedChord = rawToken
            if (options.convertScandinavianChords) {
                if (formattedChord.startsWith("H")) {
                    formattedChord = "B" + formattedChord.slice(1)
                }
            }
            chordsWithPos.push({
                chord: formattedChord,
                index: match.index
            })
        }
    }

    if (chordsWithPos.length === 0) {
        return lyricLine
    }

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

/**
 * Formats a standalone chord line (e.g. Intro: D F#m Hm A G) into ChordPro brackets.
 */
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
