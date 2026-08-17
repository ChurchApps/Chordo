import { extractAndCleanSongMetadata, isChordLine } from "../chords/chordproConverter"
import { extractBaseKey } from "../chords/transpose"

export interface PulledSongResult {
    content: string
    title?: string
    artist?: string
    key?: string
    tempo?: string
    timeSignature?: string
    album?: string
    year?: string
    copyright?: string
    composer?: string
}

/**
 * HTML Entity Unescaper
 */
export function decodeHtmlEntities(str: string): string {
    return str
        .replace(/&#x2018;/g, "'")
        .replace(/&#x2019;/g, "'")
        .replace(/&#8216;/g, "'")
        .replace(/&#8217;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&lsquo;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/\xa0/g, " ")
}

/**
 * Multi-layer HTTP client with CORS proxy fallback.
 */
async function fetchHtml(url: string): Promise<string> {
    let targetUrl = url.trim()
    if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = "https://" + targetUrl
    }

    const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }

    // 1. If target is a static text file or known open CDN, try direct fetch first
    const isDirectCdnOrFile = /\.(?:txt|chordpro|chpro)\b/i.test(targetUrl) || /cdn\.prod\.website-files\.com|raw\.githubusercontent\.com|gist\.githubusercontent\.com/i.test(targetUrl)
    if (isDirectCdnOrFile) {
        try {
            const res = await fetch(targetUrl, { signal: AbortSignal.timeout(4000) })
            if (res.ok) {
                const text = await res.text()
                if (text.trim()) return text
            }
        } catch {}
    }

    // 2. In browser (both Vite dev and Netlify production), use first-party proxy endpoint
    if (typeof window !== "undefined") {
        try {
            const netlifyProxyUrl = `/.netlify/functions/proxy?url=${encodeURIComponent(targetUrl)}`
            const res = await fetch(netlifyProxyUrl, { signal: AbortSignal.timeout(8000) })
            if (res.ok) {
                const html = await res.text()
                if (html.trim() && !html.startsWith("Proxy error:")) return html
            }
        } catch {}
    }

    // 3. In Node / non-browser environments, try direct fetch
    if (typeof window === "undefined") {
        try {
            const res = await fetch(targetUrl, { headers, signal: AbortSignal.timeout(6000) })
            if (res.ok) {
                const html = await res.text()
                if (html.trim()) return html
            }
        } catch {}
    }

    // 4. Fallback public CORS proxies (prioritized by reliability)
    const rawProxies = [
        `https://corsproxy.org/?url=${encodeURIComponent(targetUrl)}`,
        `https://cors.eu.org/${targetUrl}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
    ]

    for (const proxyUrl of rawProxies) {
        try {
            const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(6000) })
            if (res.ok) {
                const html = await res.text()
                if (
                    html.trim() &&
                    html.length > 150 &&
                    !html.includes("Server-side requests are not allowed") &&
                    !html.includes("Oops... Request Timeout") &&
                    !html.includes("403 Forbidden") &&
                    !html.includes("Access Denied")
                ) {
                    return html
                }
            }
        } catch {}
    }

    // 5. JSON-wrapping Proxy fallback: Allorigins get
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`
        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(6000) })
        if (res.ok) {
            const data = await res.json()
            if (data.contents && typeof data.contents === "string" && data.contents.trim().length > 150) {
                return data.contents
            }
        }
    } catch {}

    // 6. Final fallback: Direct fetch (for local dev or CORS-friendly targets)
    try {
        const res = await fetch(targetUrl, { headers, signal: AbortSignal.timeout(6000) })
        if (res.ok) {
            const html = await res.text()
            if (html.trim()) return html
        }
    } catch {}

    throw new Error("Could not fetch webpage. Check the URL or network connection.")
}

/**
 * Strategy 1: Extracts embedded JSON data stores (e.g. Ultimate Guitar, SongSelect, SPA page stores)
 */
export function extractJsonStoreData(html: string): { title?: string; artist?: string; key?: string; rawContent?: string } | null {
    const idx = html.indexOf('class="js-store"')
    if (idx === -1) return null

    const dataAttrIdx = html.indexOf('data-content="', Math.max(0, idx - 500))
    if (dataAttrIdx === -1) return null

    const start = dataAttrIdx + 'data-content="'.length
    const end = html.indexOf('">', start)
    if (end === -1) return null

    const rawAttr = html.slice(start, end)
    const jsonStr = decodeHtmlEntities(rawAttr)

    try {
        const parsed = JSON.parse(jsonStr)
        const tabView = parsed?.store?.page?.data?.tab_view
        const tabData = parsed?.store?.page?.data?.tab

        const title = tabData?.song_name || tabView?.headerMeta?.name
        const artist = tabData?.artist_name
        const key = tabView?.meta?.tonality_name || tabData?.tonality_name
        const wikiContent = tabView?.wiki_tab?.content

        if (wikiContent) {
            const cleaned = wikiContent
                .replace(/\[ch\](.*?)\[\/ch\]/gi, "$1")
                .replace(/\[tab\]/gi, "")
                .replace(/\[\/tab\]/gi, "")
                .trim()

            return { title, artist, key, rawContent: cleaned }
        }
    } catch {
        return null
    }

    return null
}

/**
 * Strategy 2: Extracts structured segment elements (.chord-pro-line / .chord-pro-segment)
 */
export function extractStructuredSegmentData(html: string): { title?: string; artist?: string; rawContent?: string } | null {
    if (!html.includes("chord-pro-line") && !html.includes("chordProContainer")) return null

    let title: string | undefined
    let artist: string | undefined

    const titleMatch = html.match(/<h1[^>]*class=["'][^"']*headline[^"']*["'][^>]*>(.*?)<\/h1>/i) || html.match(/<title[^>]*>(.*?)<\/title>/i)
    if (titleMatch) {
        title = titleMatch[1]
            .replace(/<[^>]+>/g, "")
            .replace(/\s*\|.*$/, "")
            .replace(/chords/i, "")
            .trim()
    }

    const artistMatch = html.match(/<p[^>]*class=["']large["'][^>]*>([\s\S]*?)<\/p>/i)
    if (artistMatch) {
        artist = artistMatch[1]
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
    }

    const lines: string[] = []
    const lineBlocks = html.split(/<div[^>]*class=["']chord-pro-line["']/i).slice(1)

    for (const block of lineBlocks) {
        let lineStr = ""
        const segBlocks = block.split(/<div[^>]*class=["']chord-pro-segment["']/i).slice(1)

        for (const seg of segBlocks) {
            const noteMatch = seg.match(/<div[^>]*class=["']chord-pro-note["'][^>]*>([\s\S]*?)<\/div>/i)
            const lyricMatch = seg.match(/<div[^>]*class=["']chord-pro-lyric["'][^>]*>([\s\S]*?)<\/div>/i)

            const noteRaw = noteMatch
                ? decodeHtmlEntities(noteMatch[1])
                      .replace(/<[^>]+>/g, " ")
                      .trim()
                : ""
            const lyricRaw = lyricMatch ? decodeHtmlEntities(lyricMatch[1]).replace(/<[^>]+>/g, " ") : ""

            if (noteRaw) {
                lineStr += `[${noteRaw}]`
            }
            lineStr += lyricRaw
        }

        const cleanedLine = lineStr.trimEnd()
        if (cleanedLine) {
            lines.push(cleanedLine)
        }
    }

    if (lines.length > 0) {
        return {
            title,
            artist,
            rawContent: lines.join("\n")
        }
    }

    return null
}

/**
 * Strategy 3 & 4: General DOM / HTML candidate extractor.
 * Strips all site chrome and isolates the highest-density chord & lyric text block.
 */
export function extractChordsTextFromHtml(htmlString: string): { rawText: string; title?: string; artist?: string } {
    let title: string | undefined
    let rawText = ""

    // 1. Extract metadata from OpenGraph or Title tags
    const titleMatch = htmlString.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i) || htmlString.match(/<title[^>]*>(.*?)<\/title>/i)
    if (titleMatch) {
        title = decodeHtmlEntities(titleMatch[1])
            .replace(/\s*[\-\|\@].*$/, "")
            .replace(/\b(chords|tabs|lyrics)\b/gi, "")
            .trim()
    }

    if (typeof DOMParser !== "undefined") {
        const parser = new DOMParser()
        const doc = parser.parseFromString(htmlString, "text/html")

        // Generic non-content UI elements, headers, sidebars, footers, social share buttons
        const removeSelectors = [
            "script",
            "style",
            "header",
            "footer",
            "nav",
            "aside",
            "form",
            "button",
            "iframe",
            "noscript",
            "svg",
            ".ad",
            ".banner",
            ".navigation",
            ".navbar",
            ".sidebar",
            ".widget",
            ".comments",
            "#comments",
            ".related",
            ".share",
            ".cookie",
            ".footer",
            ".header"
        ]
        removeSelectors.forEach((sel) => doc.querySelectorAll(sel).forEach((el) => el.remove()))

        // Check <pre> elements first (most reliable tab format)
        const preElements = Array.from(doc.querySelectorAll("pre"))
        for (const pre of preElements) {
            const text = pre.textContent || ""
            if (text.trim()) {
                let chordLines = 0
                text.split(/\r?\n/).forEach((l) => {
                    if (isChordLine(l)) chordLines++
                })
                if (chordLines >= 1) {
                    rawText = text
                    break
                }
            }
        }

        // Check targeted content containers if no valid <pre> found
        if (!rawText) {
            const contentSelectors = [".entry-content", "article", ".tabcontent", ".song-content", ".chord-pro-disp", ".tab-content", "#bip", "code"]
            for (const sel of contentSelectors) {
                const el = doc.querySelector(sel)
                if (el && el.textContent?.trim()) {
                    const text = el.textContent
                    let chordLines = 0
                    text.split(/\r?\n/).forEach((l) => {
                        if (isChordLine(l)) chordLines++
                    })
                    if (chordLines >= 1) {
                        rawText = text
                        break
                    }
                }
            }
        }

        // Fallback: Body innerText
        if (!rawText && doc.body) {
            rawText = doc.body.innerText || doc.body.textContent || ""
        }
    } else {
        // Regex fallback for non-browser environments
        const preMatches = htmlString.match(/<pre[^>]*>([\s\S]*?)<\/pre>/gi)
        if (preMatches) {
            for (const pre of preMatches) {
                const cleaned = pre.replace(/<[^>]+>/g, "").trim()
                if (cleaned) {
                    let chordLines = 0
                    cleaned.split(/\r?\n/).forEach((l) => {
                        if (isChordLine(l)) chordLines++
                    })
                    if (chordLines >= 1) {
                        rawText = cleaned
                        break
                    }
                }
            }
        }

        if (!rawText) {
            const stripped = htmlString
                .replace(/<script[\s\S]*?<\/script>/gi, "")
                .replace(/<style[\s\S]*?<\/style>/gi, "")
                .replace(/<[^>]+>/g, " ")
            rawText = stripped
        }
    }

    // Generic filtering: keep valid lines, skip empty URLs
    const cleanLines: string[] = []
    const lines = decodeHtmlEntities(rawText).split(/\r?\n/)

    for (const l of lines) {
        const tr = l.trim()
        if (/^https?:\/\//i.test(tr)) continue
        cleanLines.push(l)
    }

    const cleanedText = cleanLines
        .join("\n")
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()

    return { rawText: cleanedText, title }
}

/**
 * Validates if an extracted raw text actually contains musical chords, ChordPro markup, or lyrics.
 */
function containsValidChordLines(text: string): boolean {
    if (!text || !text.trim()) return false

    // 1. Check for inline ChordPro bracketed chords: e.g. [C], [Bbsus2], [F/A], [Gm7]
    if (/\[[A-GH][b#]?(?:m|maj|min|dim|aug|sus|add|\d|\/|\.|\?)*\]/i.test(text)) {
        return true
    }

    // 2. Check for ChordPro directives: e.g. {title:...}, {c:...}, {comment:...}
    if (/\{(?:title|t|subtitle|st|comment|c|artist|key|tempo|start_of_chorus|soc|start_of_verse|sov)\b/i.test(text)) {
        return true
    }

    // 3. Check for chord-over-lyric lines
    const lines = text.split(/\r?\n/)
    let chordLines = 0
    for (const l of lines) {
        if (isChordLine(l)) {
            chordLines++
        }
    }
    return chordLines >= 1
}

/**
 * Universal Entry Point: Fetches any web page, runs generic extraction pipeline, cleans metadata, and converts to ChordPro.
 */
export async function pullAndConvertUrl(url: string): Promise<PulledSongResult> {
    const html = await fetchHtml(url)

    // Strategy 1: JSON Store Extractor (Ultimate Guitar, etc.)
    const jsonStoreData = extractJsonStoreData(html)
    if (jsonStoreData && jsonStoreData.rawContent && containsValidChordLines(jsonStoreData.rawContent)) {
        const { cleanContent, metadata } = extractAndCleanSongMetadata(jsonStoreData.rawContent)
        const key = extractBaseKey(cleanContent, metadata.key || jsonStoreData.key)

        return {
            content: cleanContent,
            title: metadata.title || jsonStoreData.title,
            artist: metadata.artist || jsonStoreData.artist,
            key,
            tempo: metadata.tempo,
            timeSignature: metadata.timeSignature,
            album: metadata.album,
            year: metadata.year,
            copyright: metadata.copyright,
            composer: metadata.composer
        }
    }

    // Strategy 2: Structured Segment Extractor (WorshipTogether, etc.)
    const structuredData = extractStructuredSegmentData(html)
    if (structuredData && structuredData.rawContent && containsValidChordLines(structuredData.rawContent)) {
        const { cleanContent, metadata } = extractAndCleanSongMetadata(structuredData.rawContent)
        const key = extractBaseKey(cleanContent, metadata.key)

        return {
            content: cleanContent,
            title: metadata.title || structuredData.title,
            artist: metadata.artist || structuredData.artist,
            key,
            tempo: metadata.tempo,
            timeSignature: metadata.timeSignature,
            album: metadata.album,
            year: metadata.year,
            copyright: metadata.copyright,
            composer: metadata.composer
        }
    }

    // Strategy 3: Embedded Song File Extractor (lovsang.no CDN .txt / .chpro files)
    const txtUrlMatch = html.match(/initializeSongPage\(["'](https?:\/\/[^"']+)["']\)/i) || html.match(/(https?:\/\/[^"'\s>]+\.(?:txt|chordpro|chpro))\b/i)

    if (txtUrlMatch && txtUrlMatch[1]) {
        try {
            const rawSongTxt = await fetchHtml(txtUrlMatch[1])
            if (rawSongTxt && rawSongTxt.trim() && containsValidChordLines(rawSongTxt)) {
                const { cleanContent, metadata } = extractAndCleanSongMetadata(rawSongTxt.trim())
                const { title } = extractChordsTextFromHtml(html)
                const key = extractBaseKey(cleanContent, metadata.key)

                return {
                    content: cleanContent,
                    title: metadata.title || title,
                    artist: metadata.artist,
                    key,
                    tempo: metadata.tempo,
                    timeSignature: metadata.timeSignature,
                    album: metadata.album,
                    year: metadata.year,
                    copyright: metadata.copyright,
                    composer: metadata.composer
                }
            }
        } catch {
            // Fallthrough to DOM extraction if file fetch fails
        }
    }

    // Strategy 4: High-density DOM / HTML Extractor (PNW Chords, Chordie, WordPress tab sites, etc.)
    const { rawText, title } = extractChordsTextFromHtml(html)

    if (!rawText || !containsValidChordLines(rawText)) {
        throw new Error("No chords or lyrics text found on page.")
    }

    const { cleanContent, metadata } = extractAndCleanSongMetadata(rawText)
    const key = extractBaseKey(cleanContent, metadata.key)

    return {
        content: cleanContent,
        title: metadata.title || title,
        artist: metadata.artist,
        key,
        tempo: metadata.tempo,
        timeSignature: metadata.timeSignature,
        album: metadata.album,
        year: metadata.year,
        copyright: metadata.copyright,
        composer: metadata.composer
    }
}
