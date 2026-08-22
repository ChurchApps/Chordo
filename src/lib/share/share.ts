import type { List } from "$lib/models/List"
import type { Song } from "$lib/models/Song"
import { t } from "$lib/state/i18n.svelte"
import { showToast } from "$lib/state/toast.svelte"
import { encodeListShare, encodeSongShare } from "./shareCodec"
import { createShortShare } from "./shortener"

export async function copyUrlToClipboard(url: string, title?: string, hasMedia = false): Promise<boolean> {
    const successMsg = hasMedia
        ? (t("share", "link_copied_no_media") || "Share link copied! Note: Attached images/PDFs are not included.")
        : (t("share", "link_copied") || "Share link copied to clipboard!")

    if (typeof navigator !== "undefined" && navigator.share) {
        try {
            await navigator.share({
                title: title || "Chord Sheet",
                url
            })
            showToast(
                hasMedia
                    ? (t("share", "shared_no_media") || "Shared! Note: Attached images/PDFs are not included.")
                    : (t("share", "shared_success") || "Shared successfully"),
                "success",
                hasMedia ? 4000 : 3000
            )
            return true
        } catch (err) {
            if ((err as Error).name === "AbortError") return false
            // If share fails, fall through to clipboard copy
        }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
        try {
            await navigator.clipboard.writeText(url)
            showToast(successMsg, "success", hasMedia ? 4000 : 3000)
            return true
        } catch (e) {
            console.error("Clipboard copy failed:", e)
        }
    }

    // Fallback: prompt or execCommand
    try {
        const textarea = document.createElement("textarea")
        textarea.value = url
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
        showToast(successMsg, "success", hasMedia ? 4000 : 3000)
        return true
    } catch {
        showToast(t("share", "copy_failed") || "Failed to copy link", "error")
        return false
    }
}

export async function shareSong(song: Song): Promise<boolean> {
    try {
        const hasMedia = (song.images && song.images.length > 0)
        const encoded = await encodeSongShare(song)
        const url = await createShortShare(encoded)
        return await copyUrlToClipboard(url, song.name, hasMedia)
    } catch (e) {
        console.error("Error creating song share URL:", e)
        showToast(t("share", "generate_failed") || "Failed to generate share link", "error")
        return false
    }
}

export async function shareList(list: List, allSongs: Song[]): Promise<boolean> {
    try {
        const listSongs = list.getSongs(allSongs)
        const hasMedia = listSongs.some((s) => s.images && s.images.length > 0)
        const encoded = await encodeListShare(list, allSongs)
        const url = await createShortShare(encoded)
        return await copyUrlToClipboard(url, list.name, hasMedia)
    } catch (e) {
        console.error("Error creating list share URL:", e)
        showToast(t("share", "generate_failed") || "Failed to generate share link", "error")
        return false
    }
}
