import { transposeChord } from "./transpose"
import { METADATA_ALIAS_MAP, type SongMetadata } from "./metadata"

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

const COMMENT_PRESETS: Record<string, string> = {
    soc: "Chorus",
    sov: "Verse"
}

const COMMENT_KEYS = new Set(["comment", "c", "section", "soc", "eoc", "sov", "eov"])

/**
 * Parses raw ChordPro text into structured data and applies live transposition.
 * Supports standard `{key: value}` as well as unbraced `Key: Value` formats.
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

        // Matches braced directives `{key: value}` or unbraced headers `Key: Value`
        const directiveMatch = trimmed.match(/^\{([^:]+)(?::\s*(.*?))?\}$/) || trimmed.match(/^([a-zA-Z0-9_\-\/]+):\s*(.*)$/)

        if (directiveMatch) {
            const key = directiveMatch[1].trim().toLowerCase()
            const value = (directiveMatch[2] || "").trim()

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

        // Tokenize lyrics and bracketed chords [Chord]
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
