import { matchSectionHeader } from "./chordproParser"

export interface SongSection {
    id: string
    name: string
    header?: string
    lines: string[]
    rawText: string
    preview: string
    canonicalKey: string
}

function extractLyricLines(lines: string[]): string[] {
    return lines
        .filter((l) => {
            const trimmed = l.trim()
            return trimmed && !(trimmed.startsWith("{") && trimmed.endsWith("}")) && !matchSectionHeader(trimmed)
        })
        .map((l) => l.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
}

function cleanLyricsPreview(lines: string[]): string {
    return extractLyricLines(lines).slice(0, 2).join(" / ")
}

function generateCanonicalKey(name: string, lines: string[]): string {
    const text = extractLyricLines(lines).join("\n").toLowerCase()
    return text || name.trim().toLowerCase()
}

/**
 * Parses raw song text into discrete lyrics/chord sections.
 */
export function parseSongSections(text: string): SongSection[] {
    const rawLines = text.split(/\r?\n/)
    const blocks: { header?: string; lines: string[] }[] = []
    let currentBlock: { header?: string; lines: string[] } | null = null

    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i]
        const trimmed = line.trim()

        if (!trimmed) {
            // Empty line marks a potential section boundary if current block has content
            if (currentBlock && currentBlock.lines.length > 0) {
                blocks.push(currentBlock)
                currentBlock = null
            }
            continue
        }

        const sectionHeader = matchSectionHeader(trimmed)
        if (sectionHeader) {
            // New header found; finalize previous block if any
            if (currentBlock && currentBlock.lines.length > 0) {
                blocks.push(currentBlock)
            }
            currentBlock = {
                header: sectionHeader,
                lines: [line]
            }
            continue
        }

        if (!currentBlock) {
            currentBlock = {
                lines: [line]
            }
        } else {
            currentBlock.lines.push(line)
        }
    }

    if (currentBlock && currentBlock.lines.length > 0) {
        blocks.push(currentBlock)
    }

    if (blocks.length === 0) {
        return []
    }

    // Number un-numbered verses or unnamed sections
    let unlabelledCount = 0
    return blocks.map((block, idx) => {
        let name = block.header
        if (!name) {
            unlabelledCount++
            name = `Section ${unlabelledCount}`
        }

        const preview = cleanLyricsPreview(block.lines)
        const canonicalKey = generateCanonicalKey(name, block.lines)
        const rawText = block.lines.join("\n").trim()

        return {
            id: `sec-${idx}-${Math.random().toString(36).slice(2, 9)}`,
            name,
            header: block.header,
            lines: block.lines,
            rawText,
            preview,
            canonicalKey
        }
    })
}

/**
 * Returns a list of distinct/unique section templates found in the song.
 */
export function getUniqueSections(sections: SongSection[]): SongSection[] {
    const seen = new Set<string>()
    const unique: SongSection[] = []

    for (const sec of sections) {
        const key = sec.canonicalKey || sec.name.toLowerCase()
        if (!seen.has(key)) {
            seen.add(key)
            unique.push(sec)
        }
    }

    return unique
}

/**
 * Duplicates a section template with a new unique ID.
 */
export function cloneSection(section: SongSection): SongSection {
    return {
        ...section,
        id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        lines: [...section.lines]
    }
}

/**
 * Serializes an array of sections back into a complete ChordPro / song text string.
 */
export function serializeSections(sections: SongSection[]): string {
    return sections
        .map((s) => s.lines.join("\n").trim())
        .filter(Boolean)
        .join("\n\n")
}
