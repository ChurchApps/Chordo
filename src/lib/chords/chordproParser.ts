import { transposeChord, isChordToken } from "./transpose"
import { METADATA_ALIAS_MAP, type SongMetadata } from "./metadata"

export { isChordToken } from "./transpose"

export interface ChordProToken {
    chord: string // Transposed chord text or empty string
    lyric: string // Lyric segment associated with this chord or preceding it
}

export interface ParsedLine {
    type: "directive" | "comment" | "lyrics" | "empty"
    directiveKey?: string
    directiveValue?: string
    tokens?: ChordProToken[]
    rawText?: string
}

export interface ParsedChordPro {
    metadata: SongMetadata & {
        title?: string
        artist?: string
    }
    lines: ParsedLine[]
}

function formatSectionName(name: string): string {
    return name
        .trim()
        .replace(/^[\{\[\(]\s*(?:c(?:omment)?:\s*|section:\s*)?/i, "")
        .replace(/[\}\]\)]?\s*:?\s*$/, "")
        .replace(/^([A-Za-z\u00C0-\u024F\u0400-\u04FF]+)(\d+)/, "$1 $2")
        .trim()
}

/**
 * Structural detection of section/group headers regardless of language.
 */
export function matchSectionHeader(line: string): string | null {
    const trimmed = line.trim()
    if (!trimmed) return null

    // Ignore repeat count markers like [x2], (2x)
    if (/^[\(\[]\s*(?:x\s*\d+|\d+\s*x|\d+\s*times|\d+\s*ganger)\s*[\)\]]$/i.test(trimmed)) {
        return null
    }

    // 1. Braced directive: {c: ...}, {comment: ...}, {section: ...}
    const bracedMatch = trimmed.match(/^\{(?:c|comment|section):\s*(.+?)\}$/i)
    if (bracedMatch) return formatSectionName(bracedMatch[1])

    // 2. Bracketed or parenthesized line: [Verse 1], [Chorus], [Bridge], [Coro], (Intro)
    const bracketMatch = trimmed.match(/^[\(\[]([^\)\]]+)[\)\]]:?$/)
    if (bracketMatch) {
        const inner = bracketMatch[1].trim()
        if (!isChordToken(inner) && inner !== "|" && inner !== "." && inner.length <= 60) {
            return formatSectionName(inner)
        }
    }

    // 3. Line ending with colon: Vers 1:, Chorus:, Bridge:, Ref 2 & 3:, Bro:, Instrumental:
    if (trimmed.endsWith(":") && !trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        const header = trimmed.slice(0, -1).trim()
        if (header.length <= 60 && !METADATA_ALIAS_MAP[header.toLowerCase()]) {
            return formatSectionName(header)
        }
    }

    // 4. Numbered / multi-index pattern: Vers 1, Verse 1, Ref 2 & 3, Stanza II, Couplet 1 (x2)
    if (/^[A-Za-z\u00C0-\u024F\u0400-\u04FF\s]+\s+(?:\d+|[IVXLCDM]+|\(?x?\d+\)?)(?:\s*&.*|\s*\(.*\))?:?$/i.test(trimmed)) {
        return formatSectionName(trimmed)
    }

    return null
}





const COMMENT_PRESETS: Record<string, string> = {
    soc: "Chorus",
    sov: "Verse"
}

const COMMENT_KEYS = new Set(["comment", "c", "section", "soc", "eoc", "sov", "eov"])

/**
 * Parses raw ChordPro text into structured data and applies live transposition.
 * Supports standard `{key: value}`, unbraced metadata headers `Key: Value`, and section headers like `Verse 1:` / `[Verse 1]`.
 */
export function parseChordPro(text: string, semitones = 0): ParsedChordPro {
    const lines = text.split(/\r?\n/)
    const metadata: ParsedChordPro["metadata"] = {}
    const parsedLines: ParsedLine[] = []

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

        // 4. Tokenize lyrics and bracketed chords [Chord]
        const parts = line.split(/\[([^\]]+)\]/)
        const tokens: ChordProToken[] = []

        if (parts[0]) {
            tokens.push({ chord: "", lyric: parts[0] })
        }

        for (let i = 1; i < parts.length; i += 2) {
            tokens.push({
                chord: transposeChord(parts[i], semitones),
                lyric: parts[i + 1] || ""
            })
        }

        parsedLines.push({ type: "lyrics", tokens })
    }

    return { metadata, lines: parsedLines }
}
