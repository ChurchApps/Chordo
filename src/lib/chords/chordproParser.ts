import { transposeChord, chordToNashville, isChordToken, extractBaseKey } from "./transpose"
import { METADATA_ALIAS_MAP, type SongMetadata } from "./metadata"

export { isChordToken } from "./transpose"

export interface ChordProToken {
    chord: string // Transposed chord text or empty string
    lyric: string // Lyric segment associated with this chord or preceding it
}

export interface ChordWord {
    tokens: ChordProToken[]
}

export interface ParsedLine {
    type: "directive" | "comment" | "lyrics" | "empty"
    directiveKey?: string
    directiveValue?: string
    tokens?: ChordProToken[]
    words?: ChordWord[]
    rawText?: string
}


export interface ParsedSection {
    lines: ParsedLine[]
}

export interface ParsedChordPro {
    metadata: SongMetadata & {
        title?: string
        artist?: string
    }

    lines: ParsedLine[]
    sections: ParsedSection[]
}

function normalizeSection(name: string, mult = ""): string {
    const clean = name
        .trim()
        .replace(/^\{(?:c(?:omment)?:\s*|section:\s*)?/i, "")
        .replace(/[\}:]+$/g, "")
        .replace(/^([A-Za-z\u00C0-\u024F\u0400-\u04FF]+)(\d+)/, "$1 $2")
        .trim()

    return mult ? `${clean} (${mult})` : clean
}

const SECTION_KEYWORDS =
    /^(?:verse|vers|chorus|kor|refrain|refreng|ref|bridge|bro|b-del|stanza|strofe|couplet|part|del|intro|outro|ending|avslutning|coda|interlude|mellomspill|solo|pre-chorus|prechorus|pre-ref|pre-refreng|post-chorus|tag|hook|vamp|spoken|instrumental|intermezzo|theme|tema)\b/i

/**
 * Structural detection of section/group headers regardless of language.
 */
export function matchSectionHeader(line: string): string | null {
    const raw = line.trim()
    if (!raw || raw.includes("|")) return null
    if (/^[\(\[]\s*(?:x\s*\d+|\d+\s*x|\d+\s*times|\d+\s*ganger)\s*[\)\]]$/i.test(raw)) return null

    // 1. Braced directive: {c: ...}, {comment: ...}, {section: ...}
    const bracedMatch = raw.match(/^\{(?:c|comment|section):\s*(.+?)\}$/i)
    if (bracedMatch) return normalizeSection(bracedMatch[1])

    // A bracketed section header must have the entire line enclosed in brackets: e.g. [Verse 1] or [Chorus] (x2)
    const isEnclosedBracket = /^[\(\[][^\)\]]+[\)\]](?:\s*(?:[\(\[]?(?:x|\*|\b)\s*\d+[\)\]]?))?\s*$/i.test(raw)

    // Strip leading/trailing decorative markers and colons
    let str = raw.replace(/^[\s▒█■▶►◆●#=\-\*~_]+/g, "").replace(/[\s\*:]+$/g, "")

    // Extract repeat multiplier (e.g. (x2), x4, (2x))
    let mult = ""
    const multMatch = str.match(/(?:\s*[\(\[]\s*(?:x\s*|\*\s*)?(\d+)\s*(?:x|\)|\b|\]|\s*ganger|\s*times)+|\s+(?:x|\*)\s*(\d+))\s*$/i)
    if (multMatch) {
        mult = `x${multMatch[1] || multMatch[2]}`
        str = str.slice(0, multMatch.index).trim()
    }

    // Strip outer brackets/parentheses if whole string was enclosed
    if (/^\[[^\]]+\]$/.test(str) || /^\([^\)]+\)$/.test(str)) {
        str = str.slice(1, -1).trim()
    }
    if (!str) return null

    // If remaining string still contains inline brackets (like [D]Gud... [F#m7]), it's lyrics, not a section header
    if (str.includes("[") || str.includes("]")) return null

    const isKeyword = SECTION_KEYWORDS.test(str)
    const isOriginalColon = /:\s*$/i.test(raw)

    if (isKeyword || isEnclosedBracket || (isOriginalColon && str.split(/\s+/).length <= 4)) {
        const words = str.split(/[\s\-]+/).filter(Boolean)
        if (!words.some((w) => isChordToken(w))) {
            return normalizeSection(str, mult)
        }
    }

    return null
}

const COMMENT_PRESETS: Record<string, string> = {
    soc: "Chorus",
    sov: "Verse"
}


const COMMENT_KEYS = new Set(["comment", "c", "section", "soc", "eoc", "sov", "eov"])

/**
 * Parses raw ChordPro text into structured data and applies live transposition or Nashville conversion.
 * Supports standard `{key: value}`, unbraced metadata headers `Key: Value`, and section headers like `Verse 1:` / `[Verse 1]`.
 */
export function parseChordPro(text: string, semitones: number | "NNS" = 0): ParsedChordPro {
    const lines = text.split(/\r?\n/)
    const metadata: ParsedChordPro["metadata"] = {}
    const parsedLines: ParsedLine[] = []

    const baseKey = semitones === "NNS" ? extractBaseKey(text) || "C" : ""

    for (const line of lines) {
        const trimmed = line.trim()

        if (!trimmed) {
            parsedLines.push({ type: "empty" })
            continue
        }

        // 1. Matches braced directives `{key: value}` or `{key}`
        const bracedMatch = trimmed.match(/^\{([^:]+)(?::\s*(.*?))?\}$/)
        if (bracedMatch) {
            const key = bracedMatch[1].trim().toLowerCase()
            const value = (bracedMatch[2] || "").trim()

            if (key === "eoc" || key === "eov") continue

            const metaKey = METADATA_ALIAS_MAP[key]
            if (metaKey) (metadata as any)[metaKey] = value

            if (COMMENT_KEYS.has(key)) {
                parsedLines.push({
                    type: "comment",
                    directiveKey: key,
                    directiveValue: COMMENT_PRESETS[key] || value || key
                })
            } else {
                parsedLines.push({
                    type: "directive",
                    directiveKey: key,
                    directiveValue: value
                })
            }
            continue
        }

        // 2. Matches section headings: e.g. "Verse 1:", "[Verse 1]", "Vers 1:", "Chorus:", "Bridge 1:"
        const sectionHeader = matchSectionHeader(trimmed)
        if (sectionHeader) {
            parsedLines.push({
                type: "comment",
                directiveKey: "comment",
                directiveValue: sectionHeader
            })
            continue
        }

        // 3. Matches unbraced metadata headers `Key: Value`
        const unbracedMatch = trimmed.match(/^([a-zA-Z0-9_\-\/]+):\s*(.*)$/)
        if (unbracedMatch) {
            const key = unbracedMatch[1].trim().toLowerCase()
            const value = unbracedMatch[2].trim()

            const metaKey = METADATA_ALIAS_MAP[key]
            if (metaKey) {
                (metadata as any)[metaKey] = value
                parsedLines.push({
                    type: "directive",
                    directiveKey: key,
                    directiveValue: value
                })
                continue
            }
        }

        // 4. Tokenize lyrics and bracketed chords into atomic word units
        const { tokens, words } = parseLyricLineToWords(line, semitones, baseKey)
        parsedLines.push({ type: "lyrics", tokens, words })
    }

    return {
        metadata,
        lines: parsedLines,
        sections: groupLinesIntoSections(parsedLines)
    }
}

export function parseLyricLineToWords(line: string, semitones: number | "NNS" = 0, baseKey = "C"): { tokens: ChordProToken[]; words: ChordWord[] } {
    const trimmedLine = line.trimStart()
    const parts = trimmedLine.split(/\[([^\]]+)\]/)
    const rawTokens: ChordProToken[] = []

    if (parts[0]) {
        rawTokens.push({ chord: "", lyric: parts[0].trimStart() })
    }

    for (let i = 1; i < parts.length; i += 2) {
        let lyricPart = parts[i + 1] || ""
        if (/^\s+\S/.test(lyricPart)) {
            lyricPart = lyricPart.trimStart()
        }
        const chordText = semitones === "NNS" ? chordToNashville(parts[i], baseKey) : transposeChord(parts[i], semitones)
        rawTokens.push({
            chord: chordText,
            lyric: lyricPart
        })
    }

    const words: ChordWord[] = []
    let currentWordTokens: ChordProToken[] = []

    for (const raw of rawTokens) {
        const { chord, lyric } = raw

        if (!lyric) {
            if (chord) {
                currentWordTokens.push({ chord, lyric: "" })
            }
            continue
        }

        // Split lyric into word segments while keeping trailing whitespace
        const segments = lyric.match(/\S+\s*|\s+/g) || [lyric]

        for (let s = 0; s < segments.length; s++) {
            const seg = segments[s]
            const isFirst = s === 0

            // The chord belongs to the exact syllable segment where it was placed
            const segChord = isFirst ? chord : ""

            currentWordTokens.push({ chord: segChord, lyric: seg })

            if (/\s$/.test(seg)) {
                words.push({ tokens: currentWordTokens })
                currentWordTokens = []
            }
        }
    }

    if (currentWordTokens.length > 0) {
        words.push({ tokens: currentWordTokens })
    }

    const allTokens = words.flatMap((w) => w.tokens)
    return { tokens: allTokens, words }
}

export function groupLinesIntoSections(lines: ParsedLine[]): ParsedSection[] {
    const sections: ParsedSection[] = []
    let current: ParsedLine[] = []

    for (const line of lines) {
        if (line.type === "empty") {
            if (current.length) {
                sections.push({ lines: current })
                current = []
            }
        } else {
            const isHeader = line.type === "comment" || (line.type === "directive" && !METADATA_ALIAS_MAP[line.directiveKey?.toLowerCase() ?? ""])
            if (isHeader && current.length) {
                sections.push({ lines: current })
                current = []
            }
            current.push(line)
        }
    }

    if (current.length) sections.push({ lines: current })
    return sections
}

