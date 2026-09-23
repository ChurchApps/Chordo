import { transposeChord, chordToNashville, isChordToken, isRepeatToken, extractBaseKey } from "./transpose"
import { METADATA_ALIAS_MAP, type SongMetadata } from "./metadata"

export { isChordToken, isRepeatToken } from "./transpose"

export interface ChordProToken {
    chord: string // Transposed chord text or empty string
    lyric: string // Lyric segment associated with this chord or preceding it
    minWidth?: string // Minimum width when chord collision spacing is needed
    isRepeat?: boolean // True if this token represents a repeat multiplier (e.g. x2, x4, (x2))
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

/**
 * Splits a section/comment header into base name and repeat value if present.
 * E.g. "Chorus (x2)" -> { text: "Chorus", repeat: "(x2)" }
 */
export function splitCommentRepeat(comment?: string): { text: string; repeat: string } | null {
    if (!comment) return null
    const match = comment.match(/^(.*?)(\s*[\(\[]\s*(?:x\s*\d+|\d+\s*x|\*\s*\d+|\d+\s*\*)\s*[\)\]]|\s+(?:x\s*\d+|\d+\s*x|\*\s*\d+|\d+\s*\*))\s*$/i)
    if (match && match[2]) {
        return {
            text: match[1].trim(),
            repeat: match[2].trim()
        }
    }
    return null
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
    if (/^[\(\[]\s*(?:x\s*\d+|\d+\s*x)\s*[\)\]]$/i.test(raw)) return null

    // 1. Braced directive: {c: ...}, {comment: ...}, {section: ...}
    const bracedMatch = raw.match(/^\{(?:c|comment|section):\s*(.+?)\}$/i)
    if (bracedMatch) return normalizeSection(bracedMatch[1])

    // A bracketed section header must have the entire line enclosed in brackets: e.g. [Verse 1] or [Chorus] (x2)
    const isEnclosedBracket = /^[\(\[][^\)\]]+[\)\]](?:\s*(?:[\(\[]?(?:x|\*|\b)\s*\d+[\)\]]?))?\s*$/i.test(raw)

    // Strip leading/trailing decorative markers and colons
    let str = raw.replace(/^[\s▒█■▶►◆●#=\-\*~_]+/g, "").replace(/[\s\*:]+$/g, "")

    // Extract repeat multiplier (e.g. (x2), x4, (2x))
    let mult = ""
    const multMatch = str.match(/(?:\s*[\(\[]\s*(?:x\s*|\*\s*)?(\d+)\s*(?:x|\)|\b|\])+|\s+(?:x|\*)\s*(\d+))\s*$/i)
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

const SEGMENT_REGEX =
    /\((?:x\s*\d+|\d+\s*x|\*\s*\d+|\d+\s*\*)\)\s*|\[(?:x\s*\d+|\d+\s*x|\*\s*\d+|\d+\s*\*)\]\s*|\b(?:x\s+\d+|\d+\s+x)\b\s*|\S+\s*|\s+/gi

export function parseLyricLineToWords(line: string, semitones: number | "NNS" = 0, baseKey = "C"): { tokens: ChordProToken[]; words: ChordWord[] } {
    const trimmedLine = line.trimStart()
    const parts = trimmedLine.split(/\[([^\]]+)\]/)
    const rawTokens: ChordProToken[] = []

    if (parts[0]) {
        rawTokens.push({ chord: "", lyric: parts[0] })
    }

    for (let i = 1; i < parts.length; i += 2) {
        const bracketContent = parts[i].trim()
        let lyricPart = parts[i + 1] || ""

        if (/^\s+\S/.test(lyricPart)) {
            const leadingSpaces = lyricPart.match(/^\s+/)![0]
            if (rawTokens.length > 0 && !/\s$/.test(rawTokens[rawTokens.length - 1].lyric)) {
                rawTokens[rawTokens.length - 1].lyric += leadingSpaces
            }
            lyricPart = lyricPart.trimStart()
        }

        const trailingRepeatMatch = bracketContent.match(
            /^(.*?)(\s*[\(\[]\s*(?:x\s*\d+|\d+\s*x|\*\s*\d+|\d+\s*\*)\s*[\)\]]|\s+(?:x\s*\d+|\d+\s*x|\*\s*\d+|\d+\s*\*))\s*$/i
        )

        if (isRepeatToken(bracketContent)) {
            // [x2] or [(x2)] is a repeat value, not a chord!
            let repeatLyric = bracketContent
            if (rawTokens.length > 0 && !/\s$/.test(rawTokens[rawTokens.length - 1].lyric)) {
                repeatLyric = " " + repeatLyric
            }
            if (lyricPart && !/^\s/.test(lyricPart)) {
                repeatLyric = repeatLyric + " "
            }
            rawTokens.push({
                chord: "",
                lyric: repeatLyric,
                isRepeat: true
            })
            if (lyricPart) {
                rawTokens.push({
                    chord: "",
                    lyric: lyricPart
                })
            }
        } else if (trailingRepeatMatch && trailingRepeatMatch[1].trim()) {
            // Bracketed chords/bar with repeat at the end: e.g. [| F#m7 . . . | E . . . | x2] or [G C D x2]
            const chordPortion = trailingRepeatMatch[1].trim()
            const repeatPortion = trailingRepeatMatch[2].trim()

            const chordText = semitones === "NNS" ? chordToNashville(chordPortion, baseKey) : transposeChord(chordPortion, semitones)
            rawTokens.push({
                chord: chordText,
                lyric: " "
            })
            rawTokens.push({
                chord: "",
                lyric: " " + repeatPortion,
                isRepeat: true
            })
            if (lyricPart) {
                rawTokens.push({
                    chord: "",
                    lyric: lyricPart
                })
            }
        } else {
            const chordText = semitones === "NNS" ? chordToNashville(parts[i], baseKey) : transposeChord(parts[i], semitones)
            rawTokens.push({
                chord: chordText,
                lyric: lyricPart
            })
        }
    }

    const words: ChordWord[] = []
    let currentWordTokens: ChordProToken[] = []

    for (const raw of rawTokens) {
        const { chord, lyric, isRepeat } = raw

        if (!lyric) {
            if (chord) {
                currentWordTokens.push({ chord, lyric: "" })
            }
            continue
        }

        // Split lyric into word segments while detecting repeat markers
        const segments = lyric.match(SEGMENT_REGEX) || [lyric]

        for (let s = 0; s < segments.length; s++) {
            const seg = segments[s]
            const isFirst = s === 0

            // The chord belongs to the exact syllable segment where it was placed
            const segChord = isFirst ? chord : ""
            const segIsRepeat = isRepeat || isRepeatToken(seg.trim())
            let segLyric = seg
            if (segIsRepeat && currentWordTokens.length > 0 && !/\s$/.test(currentWordTokens[currentWordTokens.length - 1].lyric) && !/^\s/.test(segLyric)) {
                segLyric = " " + segLyric
            }

            currentWordTokens.push({
                chord: segChord,
                lyric: segLyric,
                ...(segIsRepeat ? { isRepeat: true } : {})
            })

            if (/\s$/.test(segLyric)) {
                words.push({ tokens: currentWordTokens })
                currentWordTokens = []
            }
        }
    }

    if (currentWordTokens.length > 0) {
        words.push({ tokens: currentWordTokens })
    }

    // Optimize words: If a word starts with an un-chorded token (e.g. "l" in "l[A]eter"),
    // snap the chord to the start of the word if it won't clip the previous chord.
    let currentPos = 0
    let lastChordEndPos = -1

    for (const word of words) {
        const wordStartPos = currentPos

        // Check if first token in word has no chord, but second token does (and first is not a repeat token)
        if (word.tokens.length > 1 && !word.tokens[0].chord && !word.tokens[0].isRepeat && word.tokens[1].chord) {
            const minAllowedPos = lastChordEndPos >= 0 ? lastChordEndPos + 1 : 0
            if (wordStartPos >= minAllowedPos) {
                word.tokens[0].chord = word.tokens[1].chord
                word.tokens[0].lyric = word.tokens[0].lyric + word.tokens[1].lyric
                word.tokens.splice(1, 1)
            }
        }

        // Update chord positions and current lyric position
        for (const token of word.tokens) {
            if (token.chord) {
                lastChordEndPos = currentPos + token.chord.length
            }
            currentPos += token.lyric.length
        }
    }

    const allTokens = words.flatMap((w) => w.tokens)

    // Calculate chord collision spacing:
    // Expand tokens if a chord would collide with the next chord or needs standalone width
    for (let i = 0; i < allTokens.length; i++) {
        const token = allTokens[i]
        if (!token.chord) continue

        // Find the next token that has a chord
        let nextChordIndex = -1
        for (let j = i + 1; j < allTokens.length; j++) {
            if (allTokens[j].chord) {
                nextChordIndex = j
                break
            }
        }

        const GAP = 1.5
        if (nextChordIndex !== -1) {
            const hasLyricText = Boolean(token.lyric && token.lyric.trim() !== "")
            if (hasLyricText) {
                // Chord has lyric words: measure visual span up to next chord
                // In proportional fonts, narrow letters & spaces average ~0.4ch, standard letters ~0.75ch of monospace width
                let lyricSpanLen = 0
                for (let k = i; k < nextChordIndex; k++) {
                    const nextTok = allTokens[k]
                    if (k > i && !nextTok.lyric?.trim() && nextTok.chord) {
                        lyricSpanLen += nextTok.chord.length + nextTok.lyric.length
                    } else {
                        const lyricStr = nextTok.lyric || ""
                        for (const char of lyricStr) {
                            if (/\s/.test(char) || /[iljf\.,'’!]/.test(char)) {
                                lyricSpanLen += 0.4
                            } else {
                                lyricSpanLen += 0.75
                            }
                        }
                    }
                }

                // A chord needs its length + GAP so it doesn't touch the next chord
                const neededLen = token.chord.length + GAP
                if (neededLen > lyricSpanLen) {
                    token.minWidth = `${neededLen}ch`
                }
            } else {
                // Standalone chord without lyric words:
                // Needs chord length + whatever trailing spaces were typed (or 1 space gap if 0 spaces between adjacent chords)
                const minLen = token.lyric.length > 0 ? token.chord.length + token.lyric.length : token.chord.length + 1
                token.minWidth = `${minLen}ch`
            }
        }
    }

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

