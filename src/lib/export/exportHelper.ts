import type { List } from "$lib/models/List"
import type { Song } from "$lib/models/Song"
import { buildListSharePayload, buildSongSharePayload, parseSharePayload, type SharePayload } from "$lib/share/shareCodec"
import { setSharePayload } from "$lib/share/share.svelte"
import { setActivePage } from "$lib/state/menu.svelte"
import { t } from "$lib/state/i18n.svelte"
import { showToast } from "$lib/state/toast.svelte"

import { sanitizeFilename } from "$lib/utils/common"

/**
 * Exports a single song as an uncompressed, full JSON file.
 */
export async function exportSongAsJson(song: Song) {
    try {
        const payload = await buildSongSharePayload(song)
        const jsonStr = JSON.stringify(payload, null, 2)
        const blob = new Blob([jsonStr], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = sanitizeFilename(`chordo_${song.name}`, "json")
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        showToast(t("export", "success"), "success")
    } catch (err) {
        console.error("Failed to export song as JSON:", err)
        showToast(t("export", "failed"), "error")
    }
}

/**
 * Exports a setlist as an uncompressed, full JSON file containing the setlist and all song data.
 */
export async function exportSetlistAsJson(list: List, allSongs: Song[]) {
    try {
        const payload = await buildListSharePayload(list, allSongs)
        const jsonStr = JSON.stringify(payload, null, 2)
        const blob = new Blob([jsonStr], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = sanitizeFilename(`chordo_${list.name}`, "json")
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        showToast(t("export", "success"), "success")
    } catch (err) {
        console.error("Failed to export setlist as JSON:", err)
        showToast(t("export", "failed"), "error")
    }
}

/**
 * Parses raw JSON string representing a song or setlist export.
 */
export function parseChordoJson(jsonStr: string): SharePayload | null {
    try {
        const parsed = JSON.parse(jsonStr)
        if (!parsed || typeof parsed !== "object") return null

        // Standard SharePayload format: { type: "list"|"song", ... }
        if (parsed.type && (parsed.song || parsed.list)) {
            return parseSharePayload(parsed)
        }

        // Direct list object format with songs / listItems
        if (parsed.songs && Array.isArray(parsed.songs)) {
            return parseSharePayload({ type: "list", list: parsed })
        }

        // Direct song object format with content or metadata
        if (parsed.name && (parsed.content !== undefined || parsed.metadata)) {
            return parseSharePayload({ type: "song", song: parsed })
        }

        return null
    } catch (e) {
        console.error("Failed to parse Chordo JSON:", e)
        return null
    }
}

export const parseSetlistJson = parseChordoJson

/**
 * Imports a song or setlist from a File object, parses it, and opens the preview & import page.
 */
export async function importChordoFile(file: File): Promise<boolean> {
    try {
        const text = await file.text()
        const payload = parseChordoJson(text)
        if (!payload) {
            showToast(t("settings", "import_invalid"), "error")
            return false
        }

        setSharePayload(payload)
        const title = payload.type === "list" ? payload.list.name : payload.song.name
        setActivePage("share_preview", null, title)
        return true
    } catch (err) {
        console.error("Error importing file:", err)
        showToast(t("settings", "import_error"), "error")
        return false
    }
}

export const importSetlistFile = importChordoFile

