import type { List } from "$lib/models/List"
import type { Song } from "$lib/models/Song"
import { buildListSharePayload, parseSharePayload, type SharePayload } from "$lib/share/shareCodec"
import { setSharePayload } from "$lib/share/share.svelte"
import { setActivePage } from "$lib/state/menu.svelte"
import { t } from "$lib/state/i18n.svelte"
import { showToast } from "$lib/state/toast.svelte"

/**
 * Exports a setlist as an uncompressed, full JSON file containing the setlist and all song data.
 */
export function exportSetlistAsJson(list: List, allSongs: Song[]) {
    try {
        const payload = buildListSharePayload(list, allSongs)
        const jsonStr = JSON.stringify(payload, null, 2)
        const blob = new Blob([jsonStr], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const safeName = "chordo_" + (list.name || "setlist").toLowerCase().replace(/[/\\?%*:|"<>]/g, "_")
        a.download = `${safeName}.json`
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
 * Parses raw JSON string representing a setlist export.
 */
export function parseSetlistJson(jsonStr: string): SharePayload | null {
    try {
        const parsed = JSON.parse(jsonStr)
        if (!parsed || typeof parsed !== "object") return null

        // Standard SharePayload format: { type: "list", list: ... }
        if (parsed.type === "list" && parsed.list) {
            return parseSharePayload(parsed)
        }

        // Direct list object format with songs / listItems
        if (parsed.songs && Array.isArray(parsed.songs)) {
            return parseSharePayload({ type: "list", list: parsed })
        }

        return null
    } catch (e) {
        console.error("Failed to parse setlist JSON:", e)
        return null
    }
}

/**
 * Imports a setlist from a File object, parses it, and opens the preview & import page.
 */
export async function importSetlistFile(file: File): Promise<boolean> {
    try {
        const text = await file.text()
        const payload = parseSetlistJson(text)
        if (!payload || payload.type !== "list") {
            showToast(t("settings", "import_invalid"), "error")
            return false
        }

        setSharePayload(payload)
        const title = payload.list.name
        setActivePage("share_preview", null, title)
        return true
    } catch (err) {
        console.error("Error importing setlist file:", err)
        showToast(t("settings", "import_error"), "error")
        return false
    }
}
